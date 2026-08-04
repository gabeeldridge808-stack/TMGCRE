import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { processUploadedDocument } from "@/lib/documents";

// Embedding + attribute-extraction calls can run long on a big document;
// give this route more headroom than Vercel's default.
export const maxDuration = 60;

interface Deal {
  asset_class: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const files = await query<{ source_filename: string; chunk_count: string; ingested_at: string }>(
    `select source_filename, count(*) as chunk_count, max(ingested_at) as ingested_at
     from documents
     where deal_id = $1
     group by source_filename
     order by max(ingested_at) desc`,
    [id]
  );
  return NextResponse.json(files);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const body = await req.json();
  const { blobUrl, pathname, filename, mimeType } = body;

  if (!blobUrl || !pathname || !filename || !mimeType) {
    return NextResponse.json(
      { error: "blobUrl, pathname, filename, and mimeType are required" },
      { status: 400 }
    );
  }

  const [deal] = await query<Deal>(`select asset_class from deals where id = $1`, [dealId]);
  if (!deal) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  try {
    const result = await processUploadedDocument({
      dealId,
      assetClass: deal.asset_class,
      blobUrl,
      pathname,
      filename,
      mimeType,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process the uploaded document." },
      { status: 500 }
    );
  }
}
