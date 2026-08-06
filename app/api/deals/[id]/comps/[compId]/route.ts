import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; compId: string }> }
) {
  const { id: dealId, compId } = await params;
  const deleted = await query<{ id: string }>(
    `delete from comps where id = $1 and deal_id = $2 returning id`,
    [compId, dealId]
  );
  if (deleted.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
