import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Previews the extracted text already stored in `documents` (see
// lib/documents.ts) rather than re-fetching the original file from Blob
// storage — the file is private, and the text is what's actually indexed/
// searched anyway, so it's the more honest thing to show as a "preview."
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const chunks = await query<{ content: string; source_filename: string }>(
    `select content, source_filename from documents
     where deal_id = $1 and drive_file_id = $2
     order by chunk_index`,
    [id, fileId]
  );

  if (chunks.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    filename: chunks[0].source_filename,
    content: chunks.map((c) => c.content).join("\n\n"),
  });
}
