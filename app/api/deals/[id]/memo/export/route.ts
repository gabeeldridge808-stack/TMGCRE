import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildMemoDocx } from "@/lib/icMemoDocx";

// Exports whatever memo text the client already has (already generated via
// POST /api/deals/[id]/memo and shown on screen) as a .docx — this route
// doesn't regenerate it, so it's fast and doesn't call Claude again.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const memoText = typeof body.memoText === "string" ? body.memoText : "";
  if (!memoText.trim()) {
    return NextResponse.json({ error: "memoText is required" }, { status: 400 });
  }

  const [deal] = await query<{ name: string }>(`select name from deals where id = $1`, [id]);
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const buffer = await buildMemoDocx(memoText, deal.name);
  const filename = `${deal.name.replace(/[^a-z0-9]+/gi, "-")}-IC-Memo.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
