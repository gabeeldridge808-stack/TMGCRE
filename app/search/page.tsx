import Link from "next/link";
import { searchPortfolio } from "@/lib/portfolioSearch";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const currentUser = await getCurrentUser();

  let results: Awaited<ReturnType<typeof searchPortfolio>> = [];
  let error: string | null = null;
  if (q && currentUser) {
    try {
      results = await searchPortfolio(q, currentUser.role === "admin" ? null : currentUser.id);
    } catch {
      error = "Search is unavailable right now — check that embeddings are configured.";
    }
  }

  return (
    <main className="page">
      <h1 style={{ marginBottom: 24 }}>Search Portfolio</h1>

      <form method="get" style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          className="field"
          name="q"
          defaultValue={q}
          placeholder="Search across every deal's documents — e.g. &quot;phase 1 ESA findings&quot;"
          style={{ flex: 1 }}
          autoFocus
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {error && <p className="text-danger">{error}</p>}

      {q && !error && results.length === 0 && <p className="text-muted">No matches found.</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {results.map((r, i) => (
          <div key={i} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <Link href={`/deals/${r.deal_id}`} style={{ fontWeight: 600 }}>
                {r.deal_name}
              </Link>
              <span className="text-faint">
                {r.source_filename}
                {r.page_number ? `, p. ${r.page_number}` : ""}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>
              {r.content.trim().slice(0, 320)}
              {r.content.trim().length > 320 ? "…" : ""}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
