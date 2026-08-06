import { query } from "@/lib/db";
import { filterDealsByQuery, filterDealsByFacets } from "@/lib/dealSearch";
import { ASSET_CLASSES, STAGES, titleCase } from "@/lib/dealConstants";
import PortfolioTable from "./PortfolioTable";

export const dynamic = "force-dynamic";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

interface PortfolioPageProps {
  searchParams?: Promise<{ q?: string; asset_class?: string; stage?: string }>;
}

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

  return (
    <main className="page">
      <h1 style={{ marginBottom: 24 }}>Portfolio</h1>

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
        <PortfolioTable deals={filteredDeals} />
      )}
    </main>
  );
}
