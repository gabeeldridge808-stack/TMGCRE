import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireDealAccess } from "@/lib/dealAccess";
import { recordAuditLog } from "@/lib/auditLog";
import {
  getDevelopmentDetails,
  upsertDevelopmentDetails,
  getAssetClassDevelopmentDetails,
  upsertAssetClassDevelopmentDetails,
  assetClassHasDevelopmentDetailTable,
} from "@/lib/development";
import type { AssetClass } from "@/lib/dealConstants";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const [deal] = await query<{ asset_class: AssetClass; deal_category: string }>(
    `select asset_class, deal_category from deals where id = $1`,
    [id]
  );
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const details = await getDevelopmentDetails(id);
  const assetClassDetails = assetClassHasDevelopmentDetailTable(deal.asset_class)
    ? await getAssetClassDevelopmentDetails(id, deal.asset_class as "industrial" | "hospitality" | "condo" | "retail")
    : null;

  return NextResponse.json({ dealCategory: deal.deal_category, assetClass: deal.asset_class, details, assetClassDetails });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const [deal] = await query<{ asset_class: AssetClass; deal_category: string }>(
    `select asset_class, deal_category from deals where id = $1`,
    [id]
  );
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (deal.deal_category !== "development") {
    return NextResponse.json({ error: "This deal isn't a development deal." }, { status: 400 });
  }

  const body = await req.json();
  const { core, assetDetails } = body as { core?: Record<string, unknown>; assetDetails?: Record<string, unknown> };

  const details = core && Object.keys(core).length > 0 ? await upsertDevelopmentDetails(id, core) : await getDevelopmentDetails(id);

  let assetClassDetails = null;
  if (assetDetails && assetClassHasDevelopmentDetailTable(deal.asset_class)) {
    assetClassDetails = await upsertAssetClassDevelopmentDetails(
      id,
      deal.asset_class as "industrial" | "hospitality" | "condo" | "retail",
      assetDetails
    );
  }

  await recordAuditLog(access.user, { dealId: id, action: "development.updated" });

  return NextResponse.json({ details, assetClassDetails });
}
