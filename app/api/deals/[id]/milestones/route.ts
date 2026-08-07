import { NextRequest, NextResponse } from "next/server";
import { requireDealAccess } from "@/lib/dealAccess";
import { recordAuditLog } from "@/lib/auditLog";
import { getMilestones, addMilestone } from "@/lib/development";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const milestones = await getMilestones(id);
  return NextResponse.json(milestones);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const body = await req.json();
  const { category, label, milestone_date, target_date, status, source_document, notes } = body;

  if (!category || !label) {
    return NextResponse.json({ error: "category and label are required" }, { status: 400 });
  }

  const milestone = await addMilestone(id, { category, label, milestone_date, target_date, status, source_document, notes });
  await recordAuditLog(access.user, { dealId: id, action: "milestone.added", details: { label } });

  return NextResponse.json(milestone, { status: 201 });
}
