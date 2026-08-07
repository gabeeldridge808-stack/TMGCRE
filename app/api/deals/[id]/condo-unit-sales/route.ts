import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireDealAccess } from "@/lib/dealAccess";
import { recordAuditLog } from "@/lib/auditLog";
import { getCondoUnitSales, addCondoUnitSalesSnapshot } from "@/lib/development";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const snapshots = await getCondoUnitSales(id);
  return NextResponse.json(snapshots);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const [deal] = await query<{ asset_class: string }>(`select asset_class from deals where id = $1`, [id]);
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (deal.asset_class !== "condo") {
    return NextResponse.json({ error: "Unit-sales tracking only applies to condo deals." }, { status: 400 });
  }

  const body = await req.json();
  const { as_of_date, units_released, units_under_contract, units_closed } = body;

  if (!as_of_date || units_released == null || units_under_contract == null || units_closed == null) {
    return NextResponse.json(
      { error: "as_of_date, units_released, units_under_contract, and units_closed are required" },
      { status: 400 }
    );
  }

  const snapshot = await addCondoUnitSalesSnapshot(id, { as_of_date, units_released, units_under_contract, units_closed });
  await recordAuditLog(access.user, { dealId: id, action: "condo_unit_sales.logged", details: { as_of_date } });

  return NextResponse.json(snapshot, { status: 201 });
}
