import { query } from "@/lib/db";
import KanbanBoard from "./KanbanBoard";

export const dynamic = "force-dynamic";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

export default async function BoardPage() {
  const deals = await query<Deal>(`select id, name, asset_class, stage, owner from deals order by created_at desc`);

  return (
    <main className="page" style={{ maxWidth: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Pipeline</h1>
        <a href="/" className="btn btn-secondary btn-sm">
          List view
        </a>
      </div>
      <KanbanBoard deals={deals} />
    </main>
  );
}
