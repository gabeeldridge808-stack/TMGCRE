import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createDeal, describeDealWriteError, type Deal } from "@/lib/deals";
import { getCurrentUser } from "@/lib/session";
import { recordAuditLog } from "@/lib/auditLog";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const deals =
    currentUser.role === "admin"
      ? await query<Deal>(`select * from deals order by created_at desc`)
      : await query<Deal>(`select * from deals where owner_id = $1 order by created_at desc`, [currentUser.id]);

  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, asset_class, stage, owner_id } = body;

  // Same rule as the New Deal form's server action: only an admin can set
  // someone else as the owner — everyone else's deals default to themselves.
  const effectiveOwnerId = currentUser.role === "admin" && owner_id ? owner_id : currentUser.id;

  if (!name || !asset_class) {
    return NextResponse.json(
      { error: "name and asset_class are required" },
      { status: 400 }
    );
  }

  try {
    const deal = await createDeal({ name, asset_class, stage: stage || "sourcing", owner_id: effectiveOwnerId });
    await recordAuditLog(currentUser, { dealId: deal.id, action: "deal.created" });
    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    const { status, message } = describeDealWriteError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
