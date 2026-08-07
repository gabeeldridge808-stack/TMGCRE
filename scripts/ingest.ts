// Document ingestion CLI.
//
//   npx tsx scripts/ingest.ts --deal-id <uuid> --drive-folder-id <id> [--dry-run]
//   npx tsx scripts/ingest.ts --all [--dry-run]
//
// The first form ingests one deal and also links it to that Drive folder
// (deals.drive_folder_id) for next time. --all re-syncs every deal that's
// already linked this way — previously this script only supported one
// deal per invocation; generalizing it to a batch mode was a deliberate,
// separate next step, and this is that step.
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
  all: boolean;
  dealId?: string;
  driveFolderId?: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };

  const all = args.includes("--all");
  const dealId = get("--deal-id");
  const driveFolderId = get("--drive-folder-id");
  const dryRun = args.includes("--dry-run");

  if (all) {
    if (dealId || driveFolderId) {
      console.error("--all can't be combined with --deal-id / --drive-folder-id.");
      process.exit(1);
    }
    return { all, dryRun };
  }

  if (!dealId || !driveFolderId) {
    console.error(
      "Usage: ingest.ts --deal-id <uuid> --drive-folder-id <id> [--dry-run]\n" +
        "       ingest.ts --all [--dry-run]  (re-syncs every deal already linked to a folder)"
    );
    process.exit(1);
  }

  return { all, dealId, driveFolderId, dryRun };
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

/** Ingests one deal's Drive folder. Used both for a single --deal-id run and for each deal in an --all run. */
async function ingestDeal(dealId: string, assetClass: string, driveFolderId: string, dryRun: boolean): Promise<void> {
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
      assetClass,
      existing.map((e) => e.key),
      sourceDocuments
    );

    if (found.length === 0) {
      console.log("  No new attributes found.");
    } else {
      const results = await writeNewAttributes(dealId, found);
      const written = results.filter((w) => w.written);
      const skipped = results.filter((w) => !w.written);
      for (const w of written) console.log(`  + ${w.key}`);
      if (skipped.length > 0) {
        console.log(`  (skipped, locked by a human edit: ${skipped.map((w) => w.key).join(", ")})`);
      }
      console.log(`  ${written.length} attribute(s) written.`);
    }
  }
}

async function main() {
  const args = parseArgs();

  if (args.all) {
    const deals = await query<{ id: string; name: string; asset_class: string; drive_folder_id: string }>(
      `select id, name, asset_class, drive_folder_id from deals where drive_folder_id is not null order by name`
    );
    if (deals.length === 0) {
      console.log("No deals are linked to a Drive folder yet — run with --deal-id/--drive-folder-id first.");
      process.exit(0);
    }
    console.log(`Re-syncing ${deals.length} linked deal(s)...\n`);
    for (const deal of deals) {
      console.log(`=== ${deal.name} (${deal.id}) ===`);
      await ingestDeal(deal.id, deal.asset_class, deal.drive_folder_id, args.dryRun);
      console.log("");
    }
    process.exit(0);
  }

  const { dealId, driveFolderId, dryRun } = args as Required<Pick<Args, "dealId" | "driveFolderId">> & Args;

  const [deal] = await query<{ id: string; asset_class: string }>(
    `select id, asset_class from deals where id = $1`,
    [dealId]
  );
  if (!deal) {
    console.error(`No deal found with id ${dealId}`);
    process.exit(1);
  }

  if (!dryRun) {
    await query(`update deals set drive_folder_id = $2 where id = $1`, [dealId, driveFolderId]);
  }

  await ingestDeal(dealId, deal.asset_class, driveFolderId, dryRun);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
