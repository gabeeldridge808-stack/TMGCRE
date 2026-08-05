import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { query } from "@/lib/db";
import { processUploadedDocument } from "@/lib/documents";

// Embedding + attribute-extraction (3 parallel Claude calls, one per
// schema section — see lib/attributeSchemas.ts) can run long on a real
// document. 60s (Vercel's Hobby-plan ceiling) was measured too tight and
// hit "Task timed out after 60 seconds" in production; ask for more and
// let the platform clamp it if the plan doesn't allow it.
export const maxDuration = 300;

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

// Upload goes through this server route (not a direct-to-Blob client token
// exchange — see README) and so inherits Vercel's 4.5MB request body limit.
// Traded a size ceiling for a much simpler, more reliable path: no token
// exchange, no cross-origin browser upload complexity.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;

  const [deal] = await query<Deal>(`select asset_class from deals where id = $1`, [dealId]);
  if (!deal) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // access: "private" — the Blob store is provisioned private-only; a
    // "public" request is rejected outright. Text extraction below reads
    // `buffer` directly rather than fetching this URL back, so the store's
    // access mode doesn't affect anything except this upload call.
    const blob = await put(`deals/${dealId}/${file.name}`, buffer, {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type,
    });

    const result = await processUploadedDocument({
      dealId,
      assetClass: deal.asset_class,
      buffer,
      pathname: blob.pathname,
      filename: file.name,
      mimeType: file.type,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process the uploaded document." },
      { status: 500 }
    );
  }
}
