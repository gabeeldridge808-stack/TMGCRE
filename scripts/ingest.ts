// Document ingestion CLI.
//
//   npx tsx scripts/ingest.ts --deal-id <uuid> --drive-folder-id <id> [--dry-run]
//
// --dry-run extracts and chunks every file but skips embeddings + DB writes.
// Run this first against a real deal's Drive folder to see what breaks on
// messy real-world files (scanned PDFs, weird encodings, Google Sheets,
// etc.) before spending API calls or touching the database.

import "dotenv/config";
import { createHash } from "node:crypto";
import { query } from "../lib/db";
import { listFilesInFolder, downloadFile, type DriveFile } from "../lib/gdrive";
import { extractText, SUPPORTED_MIME_TYPES } from "../lib/extract";
import { chunkText } from "../lib/chunk";
import { embedDocuments } from "../lib/embeddings";
import { pgvector } from "../lib/db";
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

interface PreparedChunk {
  content: string;
  contentHash: string;
  chunkIndex: number;
  pageNumber: number | null;
}

interface PreparedFile {
  chunks: PreparedChunk[];
  /** Full extracted text, pre-chunking — what attribute extraction reads. */
  fullText: string;
}

async function prepareFile(file: DriveFile): Promise<PreparedFile | { skipped: string }> {
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

  const chunks: PreparedChunk[] = [];
  let chunkIndex = 0;
  for (const page of pages) {
    for (const content of chunkText(page.text)) {
      chunks.push({
        content,
        contentHash: createHash("sha256").update(content).digest("hex"),
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
      });
    }
  }

  return { chunks, fullText: pages.map((p) => p.text).join("\n\n") };
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

      console.log(`  OK     ${label} — ${result.chunks.length} chunk(s)`);
      extracted++;
      totalChunks += result.chunks.length;

      if (dryRun) continue;

      sourceDocuments.push({ filename: file.name, text: result.fullText });

      const embeddings = await embedDocuments(result.chunks.map((c) => c.content));

      await query(
        `delete from documents where deal_id = $1 and drive_file_id = $2 and chunk_index >= $3`,
        [dealId, file.id, result.chunks.length]
      );

      for (let i = 0; i < result.chunks.length; i++) {
        const chunk = result.chunks[i];
        await query(
          `insert into documents
             (deal_id, drive_file_id, drive_modified_time, source_filename, mime_type,
              chunk_index, chunk_count, page_number, content, content_hash, embedding)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (deal_id, drive_file_id, chunk_index)
           do update set
             drive_modified_time = excluded.drive_modified_time,
             source_filename = excluded.source_filename,
             mime_type = excluded.mime_type,
             chunk_count = excluded.chunk_count,
             page_number = excluded.page_number,
             content = excluded.content,
             content_hash = excluded.content_hash,
             embedding = excluded.embedding,
             ingested_at = now()
           where documents.content_hash != excluded.content_hash`,
          [
            dealId,
            file.id,
            file.modifiedTime,
            file.name,
            file.mimeType,
            chunk.chunkIndex,
            result.chunks.length,
            chunk.pageNumber,
            chunk.content,
            chunk.contentHash,
            pgvector.toSql(embeddings[i]),
          ]
        );
      }
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
