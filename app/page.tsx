import { query } from "@/lib/db";
import { filterDealsByQuery, filterDealsByFacets, paginate } from "@/lib/dealSearch";
import { ASSET_CLASSES, STAGES, titleCase } from "@/lib/dealConstants";
import { getCurrentUser } from "@/lib/session";
import type { DateAttributeRow } from "@/lib/keyDates";
import PortfolioTable from "./PortfolioTable";
import KeyDatesWidget from "./KeyDatesWidget";

export const dynamic = "force-dynamic";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

interface PortfolioPageProps {
  searchParams?: Promise<{ q?: string; asset_class?: string; stage?: string; page?: string }>;
}

const PAGE_SIZE = 25;

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const params = await searchParams;
  const search = params?.q ?? "";
  const assetClassFilter = params?.asset_class ?? "";
  const stageFilter = params?.stage ?? "";

  const deals = await query<Deal>(
    `select id, name, asset_class, stage, owner from deals order by created_at desc`
  );
  const filteredDeals = filterDealsByFacets(filterDealsByQuery(deals, search), {
    assetClass: assetClassFilter,
    stage: stageFilter,
  });
  const pageNum = Number(params?.page) || 1;
  const { items: pagedDeals, page: currentPage, totalPages } = paginate(filteredDeals, pageNum, PAGE_SIZE);

  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const dateAttrRows = await query<DateAttributeRow>(
    `select da.deal_id, d.name as deal_name, da.key, da.value
     from deal_attributes da
     join deals d on d.id = da.deal_id
     where da.key in ('closing_date', 'rate_lock_date') and d.stage not in ('closed', 'dead')`
  );

  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Portfolio</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={`/api/deals/export?q=${encodeURIComponent(search)}&asset_class=${encodeURIComponent(assetClassFilter)}&stage=${encodeURIComponent(stageFilter)}`}
            className="btn btn-secondary btn-sm"
          >
            Export CSV
          </a>
          <a href="/board" className="btn btn-secondary btn-sm">
            Board view
          </a>
        </div>
      </div>

      <KeyDatesWidget rows={dateAttrRows} />

      <form method="get" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          className="field"
          name="q"
          defaultValue={search}
          placeholder="Search deals by name, asset class, stage, or owner"
          style={{ flex: "1 1 260px" }}
        />
        <select className="field" name="asset_class" defaultValue={assetClassFilter} style={{ width: "auto" }}>
          <option value="">All Asset Classes</option>
          {ASSET_CLASSES.map((ac) => (
            <option key={ac} value={ac}>
              {titleCase(ac)}
            </option>
          ))}
        </select>
        <select className="field" name="stage" defaultValue={stageFilter} style={{ width: "auto" }}>
          <option value="">All Stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
      </form>

      {filteredDeals.length === 0 ? (
        <p className="text-muted">No deals match your search.</p>
      ) : (
        <>
          <PortfolioTable deals={pagedDeals} isAdmin={isAdmin} />
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <span className="text-muted" style={{ fontSize: 13 }}>
                Page {currentPage} of {totalPages} ({filteredDeals.length} deals)
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={`/?q=${encodeURIComponent(search)}&asset_class=${encodeURIComponent(assetClassFilter)}&stage=${encodeURIComponent(stageFilter)}&page=${currentPage - 1}`}
                  className="btn btn-secondary btn-sm"
                  aria-disabled={currentPage <= 1}
                  style={currentPage <= 1 ? { pointerEvents: "none", opacity: 0.5 } : undefined}
                >
                  Previous
                </a>
                <a
                  href={`/?q=${encodeURIComponent(search)}&asset_class=${encodeURIComponent(assetClassFilter)}&stage=${encodeURIComponent(stageFilter)}&page=${currentPage + 1}`}
                  className="btn btn-secondary btn-sm"
                  aria-disabled={currentPage >= totalPages}
                  style={currentPage >= totalPages ? { pointerEvents: "none", opacity: 0.5 } : undefined}
                >
                  Next
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
