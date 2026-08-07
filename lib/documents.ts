// Shared "write a source file's extracted pages into `documents`" logic —
// used by both scripts/ingest.ts (Drive) and the direct-upload API route
// (app/api/deals/[id]/documents/route.ts). Chunking, embedding, and the
// upsert-by-content-hash pattern only need to exist once.
import { createHash } from "node:crypto";
import { query, pgvector } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { embedDocuments } from "@/lib/embeddings";
import { extractText, SUPPORTED_MIME_TYPES, type ExtractedPage } from "@/lib/extract";
import { extractAttributesFromText, writeNewAttributes } from "@/lib/extractAttributes";

export interface WriteChunksResult {
  chunkCount: number;
}

/**
 * Chunks, embeds, and writes one source file's pages to `documents`.
 * `fileId` is the dedup/re-sync identity for the file — a Drive file ID
 * when ingested from Drive, or a Blob pathname when uploaded directly —
 * stored in the `drive_file_id` column either way (see schema.sql).
 */
export async function writeDocumentChunks(params: {
  dealId: string;
  fileId: string;
  modifiedTime: string; // ISO 8601
  filename: string;
  mimeType: string;
  pages: ExtractedPage[];
}): Promise<WriteChunksResult> {
  const chunks: { content: string; contentHash: string; chunkIndex: number; pageNumber: number | null }[] = [];
  let chunkIndex = 0;
  for (const page of params.pages) {
    for (const content of chunkText(page.text)) {
      chunks.push({
        content,
        contentHash: createHash("sha256").update(content).digest("hex"),
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
      });
    }
  }

  if (chunks.length === 0) {
    return { chunkCount: 0 };
  }

  const embeddings = await embedDocuments(chunks.map((c) => c.content));

  await query(
    `delete from documents where deal_id = $1 and drive_file_id = $2 and chunk_index >= $3`,
    [params.dealId, params.fileId, chunks.length]
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
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
        params.dealId,
        params.fileId,
        params.modifiedTime,
        params.filename,
        params.mimeType,
        chunk.chunkIndex,
        chunks.length,
        chunk.pageNumber,
        chunk.content,
        chunk.contentHash,
        pgvector.toSql(embeddings[i]),
      ]
    );
  }

  return { chunkCount: chunks.length };
}

export interface ProcessUploadResult {
  filename: string;
  chunkCount: number;
  attributesAdded: string[];
  warning?: string;
}

/**
 * End-to-end handling for one directly-uploaded file: extract, write
 * chunks, then run the same attribute-extraction pass ingest.ts runs (see
 * lib/extractAttributes.ts) so uploads and Drive ingestion behave
 * identically once text is in hand. Takes the file's bytes directly rather
 * than re-fetching them from Blob storage — the caller already has them in
 * memory from the upload request, and the store is private, so a plain
 * unauthenticated fetch of the blob URL wouldn't work anyway.
 */
export async function processUploadedDocument(params: {
  dealId: string;
  assetClass: string;
  buffer: Buffer;
  pathname: string;
  filename: string;
  mimeType: string;
}): Promise<ProcessUploadResult> {
  if (!SUPPORTED_MIME_TYPES.has(params.mimeType)) {
    throw new Error(`Unsupported file type (${params.mimeType}). Supported: PDF, Word (.docx), plain text.`);
  }

  const pages = await extractText(params.buffer, params.mimeType);

  if (pages.length === 0) {
    return {
      filename: params.filename,
      chunkCount: 0,
      attributesAdded: [],
      warning: "No extractable text found — likely a scanned/image-only file (OCR isn't supported yet).",
    };
  }

  const { chunkCount } = await writeDocumentChunks({
    dealId: params.dealId,
    fileId: params.pathname,
    modifiedTime: new Date().toISOString(),
    filename: params.filename,
    mimeType: params.mimeType,
    pages,
  });

  const existingKeys = await query<{ key: string }>(
    `select key from deal_attributes where deal_id = $1`,
    [params.dealId]
  );
  const found = await extractAttributesFromText(
    params.assetClass,
    existingKeys.map((e) => e.key),
    [{ filename: params.filename, text: pages.map((p) => p.text).join("\n\n") }]
  );
  const written = found.length > 0 ? await writeNewAttributes(params.dealId, found) : [];

  return {
    filename: params.filename,
    chunkCount,
    attributesAdded: written.filter((w) => w.written).map((w) => w.key),
  };
}
