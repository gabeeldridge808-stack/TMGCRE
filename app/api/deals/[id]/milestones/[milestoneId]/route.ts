import { NextRequest, NextResponse } from "next/server";
import { requireDealAccess } from "@/lib/dealAccess";
import { recordAuditLog } from "@/lib/auditLog";
import { updateMilestone, deleteMilestone } from "@/lib/development";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const { id, milestoneId } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const body = await req.json();
  const { milestone_date, target_date, status, notes } = body;

  const milestone = await updateMilestone(milestoneId, id, { milestone_date, target_date, status, notes });
  if (!milestone) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await recordAuditLog(access.user, { dealId: id, action: "milestone.updated", details: { label: milestone.label } });

  return NextResponse.json(milestone);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const { id, milestoneId } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const deleted = await deleteMilestone(milestoneId, id);
  if (!deleted) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await recordAuditLog(access.user, { dealId: id, action: "milestone.deleted" });

  return NextResponse.json({ ok: true });
}
