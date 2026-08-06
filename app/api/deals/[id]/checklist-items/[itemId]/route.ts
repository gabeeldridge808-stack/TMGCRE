import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: dealId, itemId } = await params;
  const body = await req.json();
  const done = Boolean(body.done);

  const [item] = await query<{ id: string }>(
    `update deal_checklist_items set done = $1 where id = $2 and deal_id = $3 returning id`,
    [done, itemId, dealId]
  );
  if (!item) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
