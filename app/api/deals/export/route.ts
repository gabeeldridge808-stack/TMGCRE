import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { filterDealsByQuery, filterDealsByFacets } from "@/lib/dealSearch";
import { toCsv } from "@/lib/csvExport";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner_name: string;
  deal_category: string;
  created_at: string;
}

// Exports whatever the Portfolio page's current filters would show, not
// the whole table unconditionally — reuses the same pure filter functions
// the page itself uses, so "export" always matches "what I'm looking at."
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("q") ?? "";
  const assetClass = req.nextUrl.searchParams.get("asset_class") ?? "";
  const stage = req.nextUrl.searchParams.get("stage") ?? "";
  const dealCategory = req.nextUrl.searchParams.get("deal_category") ?? "";

  const isAdmin = currentUser.role === "admin";
  const deals = await query<Deal>(
    isAdmin
      ? `select d.id, d.name, d.asset_class, d.stage, d.deal_category, u.name as owner_name, d.created_at
         from deals d join users u on u.id = d.owner_id
         order by d.created_at desc`
      : `select d.id, d.name, d.asset_class, d.stage, d.deal_category, u.name as owner_name, d.created_at
         from deals d join users u on u.id = d.owner_id
         where d.owner_id = $1
         order by d.created_at desc`,
    isAdmin ? [] : [currentUser.id]
  );
  const filtered = filterDealsByFacets(filterDealsByQuery(deals, search), { assetClass, stage, dealCategory });

  const csv = toCsv(
    filtered.map((d) => ({
      name: d.name,
      asset_class: d.asset_class,
      stage: d.stage,
      deal_category: d.deal_category,
      owner: d.owner_name,
      created_at: d.created_at,
    }))
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="portfolio.csv"`,
    },
  });
}
