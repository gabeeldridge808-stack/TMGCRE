import Link from "next/link";
import { query } from "@/lib/db";
import { filterDealsByQuery, filterDealsByFacets } from "@/lib/dealSearch";
import { ASSET_CLASSES, STAGES, titleCase } from "@/lib/dealConstants";
import DeleteDealButton from "./DeleteDealButton";

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

const fieldStyle = { padding: "10px 12px", border: "1px solid #ccc", borderRadius: 6, fontSize: 16 } as const;

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
    <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Portfolio</h1>
        <Link href="/deals/new" style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none" }}>
          New deal
        </Link>
      </div>

      <form method="get" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          name="q"
          defaultValue={search}
          placeholder="Search deals by name, asset class, stage, or owner"
          style={{ ...fieldStyle, flex: "1 1 260px" }}
        />
        <select name="asset_class" defaultValue={assetClassFilter} style={fieldStyle}>
          <option value="">All Asset Classes</option>
          {ASSET_CLASSES.map((ac) => (
            <option key={ac} value={ac}>
              {titleCase(ac)}
            </option>
          ))}
        </select>
        <select name="stage" defaultValue={stageFilter} style={fieldStyle}>
          <option value="">All Stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
        <button type="submit" style={{ ...fieldStyle, cursor: "pointer" }}>
          Filter
        </button>
      </form>

      {filteredDeals.length === 0 ? (
        <p>No deals match your search.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "8px 4px" }}>Name</th>
              <th style={{ padding: "8px 4px" }}>Asset Class</th>
              <th style={{ padding: "8px 4px" }}>Stage</th>
              <th style={{ padding: "8px 4px" }}>Owner</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredDeals.map((deal) => (
              <tr key={deal.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 4px" }}>
                  <Link href={`/deals/${deal.id}`}>{deal.name}</Link>
                </td>
                <td style={{ padding: "8px 4px" }}>{titleCase(deal.asset_class)}</td>
                <td style={{ padding: "8px 4px" }}>{titleCase(deal.stage)}</td>
                <td style={{ padding: "8px 4px" }}>{deal.owner}</td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>
                  <DeleteDealButton dealId={deal.id} dealName={deal.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
