import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { filterDealsByQuery, filterDealsByFacets } from "@/lib/dealSearch";
import { toCsv } from "@/lib/csvExport";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
  created_at: string;
}

// Exports whatever the Portfolio page's current filters would show, not
// the whole table unconditionally — reuses the same pure filter functions
// the page itself uses, so "export" always matches "what I'm looking at."
export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q") ?? "";
  const assetClass = req.nextUrl.searchParams.get("asset_class") ?? "";
  const stage = req.nextUrl.searchParams.get("stage") ?? "";

  const deals = await query<Deal>(`select id, name, asset_class, stage, owner, created_at from deals order by created_at desc`);
  const filtered = filterDealsByFacets(filterDealsByQuery(deals, search), { assetClass, stage });

  const csv = toCsv(
    filtered.map((d) => ({
      name: d.name,
      asset_class: d.asset_class,
      stage: d.stage,
      owner: d.owner,
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
