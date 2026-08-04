import Link from "next/link";
import { query } from "@/lib/db";
import { filterDealsByQuery } from "@/lib/dealSearch";

export const dynamic = "force-dynamic";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

interface PortfolioPageProps {
  searchParams?: Promise<{ q?: string }>;
}

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const params = await searchParams;
  const search = params?.q ?? "";
  const deals = await query<Deal>(
    `select id, name, asset_class, stage, owner from deals order by created_at desc`
  );
  const filteredDeals = filterDealsByQuery(deals, search);

  return (
    <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Portfolio</h1>
        <Link href="/deals/new" style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none" }}>
          New deal
        </Link>
      </div>

      <form method="get" style={{ marginBottom: 24 }}>
        <input
          name="q"
          defaultValue={search}
          placeholder="Search deals by name, asset class, stage, or owner"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
            fontSize: 16,
          }}
        />
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
            </tr>
          </thead>
          <tbody>
            {filteredDeals.map((deal) => (
              <tr key={deal.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 4px" }}>
                  <Link href={`/deals/${deal.id}`}>{deal.name}</Link>
                </td>
                <td style={{ padding: "8px 4px" }}>{deal.asset_class}</td>
                <td style={{ padding: "8px 4px" }}>{deal.stage}</td>
                <td style={{ padding: "8px 4px" }}>{deal.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
