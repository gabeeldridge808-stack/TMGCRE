import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireDealAccess } from "@/lib/dealAccess";
import { recordAuditLog } from "@/lib/auditLog";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; compId: string }> }
) {
  const { id: dealId, compId } = await params;

  const access = await requireDealAccess(dealId);
  if (!access.ok) return access.response;

  const deleted = await query<{ id: string; property_name: string | null }>(
    `delete from comps where id = $1 and deal_id = $2 returning id, property_name`,
    [compId, dealId]
  );
  if (deleted.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await recordAuditLog(access.user, {
    dealId,
    action: "comps.deleted",
    details: { property_name: deleted[0].property_name },
  });

  return NextResponse.json({ ok: true });
}
