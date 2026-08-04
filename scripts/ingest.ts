// Document ingestion CLI.
//
//   npx tsx scripts/ingest.ts --deal-id <uuid> --drive-folder-id <id> [--dry-run]
//
// --dry-run extracts and chunks every file but skips embeddings + DB writes.
// Run this first against a real deal's Drive folder to see what breaks on
// messy real-world files (scanned PDFs, weird encodings, Google Sheets,
// etc.) before spending API calls or touching the database.

import "dotenv/config";
import { query } from "../lib/db";
import { listFilesInFolder, downloadFile, type DriveFile } from "../lib/gdrive";
import { extractText, SUPPORTED_MIME_TYPES, type ExtractedPage } from "../lib/extract";
import { chunkText } from "../lib/chunk";
import { writeDocumentChunks } from "../lib/documents";
import { extractAttributesFromText, writeNewAttributes, type SourceDocument } from "../lib/extractAttributes";

interface Args {
  dealId: string;
  driveFolderId: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };

  const dealId = get("--deal-id");
  const driveFolderId = get("--drive-folder-id");
  const dryRun = args.includes("--dry-run");

  if (!dealId || !driveFolderId) {
    console.error("Usage: ingest.ts --deal-id <uuid> --drive-folder-id <id> [--dry-run]");
    process.exit(1);
  }

  return { dealId, driveFolderId, dryRun };
}

async function prepareFile(file: DriveFile): Promise<ExtractedPage[] | { skipped: string }> {
  // A Google Doc downloads as text/plain (see lib/gdrive.ts), so check the
  // *source* mime type here for the "explicitly skip, don't fail" list.
  const isGoogleDoc = file.mimeType === "application/vnd.google-apps.document";
  if (!isGoogleDoc && !SUPPORTED_MIME_TYPES.has(file.mimeType)) {
    return { skipped: `unsupported type: ${file.mimeType}` };
  }

  const { buffer, mimeType } = await downloadFile(file);
  const pages = await extractText(buffer, mimeType);

  if (pages.length === 0) {
    return { skipped: "no extractable text (likely scanned/image-only — OCR not implemented)" };
  }

  return pages;
}

async function main() {
  const { dealId, driveFolderId, dryRun } = parseArgs();

  const [deal] = await query<{ id: string; asset_class: string }>(
    `select id, asset_class from deals where id = $1`,
    [dealId]
  );
  if (!deal) {
    console.error(`No deal found with id ${dealId}`);
    process.exit(1);
  }

  console.log(`Listing files under Drive folder ${driveFolderId}...`);
  const files = await listFilesInFolder(driveFolderId);
  console.log(`Found ${files.length} file(s).\n`);

  let extracted = 0;
  let skipped = 0;
  let errored = 0;
  let totalChunks = 0;
  const sourceDocuments: SourceDocument[] = [];

  for (const file of files) {
    const label = file.folderPath ? `${file.folderPath}/${file.name}` : file.name;
    try {
      const result = await prepareFile(file);

      if ("skipped" in result) {
        console.log(`  SKIP   ${label} — ${result.skipped}`);
        skipped++;
        continue;
      }

      const pages = result;

      if (dryRun) {
        // Dry-run previews the chunk count without embedding or writing —
        // chunkText() alone is cheap and has no side effects.
        const chunkCount = pages.reduce((n, p) => n + chunkText(p.text).length, 0);
        console.log(`  OK     ${label} — ${chunkCount} chunk(s)`);
        extracted++;
        totalChunks += chunkCount;
        continue;
      }

      sourceDocuments.push({ filename: file.name, text: pages.map((p) => p.text).join("\n\n") });

      const { chunkCount } = await writeDocumentChunks({
        dealId,
        fileId: file.id,
        modifiedTime: file.modifiedTime,
        filename: file.name,
        mimeType: file.mimeType,
        pages,
      });

      console.log(`  OK     ${label} — ${chunkCount} chunk(s)`);
      extracted++;
      totalChunks += chunkCount;
    } catch (err) {
      console.log(`  ERROR  ${label} — ${(err as Error).message}`);
      errored++;
    }
  }

  console.log(`\n${dryRun ? "[dry run] " : ""}Done. ${extracted} extracted (${totalChunks} chunks), ${skipped} skipped, ${errored} errored.`);

  if (!dryRun && sourceDocuments.length > 0) {
    console.log(`\nExtracting structured attributes from ${sourceDocuments.length} document(s)...`);
    const existing = await query<{ key: string }>(
      `select key from deal_attributes where deal_id = $1`,
      [dealId]
    );
    const found = await extractAttributesFromText(
      deal.asset_class,
      existing.map((e) => e.key),
      sourceDocuments
    );

    if (found.length === 0) {
      console.log("  No new attributes found.");
    } else {
      const written = await writeNewAttributes(dealId, found);
      const inserted = written.filter((w) => w.inserted);
      const alreadyRecorded = written.filter((w) => !w.inserted);
      for (const w of inserted) console.log(`  + ${w.key}`);
      if (alreadyRecorded.length > 0) {
        console.log(`  (skipped, already recorded: ${alreadyRecorded.map((w) => w.key).join(", ")})`);
      }
      console.log(`  ${inserted.length} attribute(s) added.`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
