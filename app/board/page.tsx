import { queryOrThrow } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import KanbanBoard from "./KanbanBoard";

export const dynamic = "force-dynamic";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner_name: string;
}

export default async function BoardPage() {
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  let deals: Deal[] = [];
  let loadError: string | null = null;
  try {
    if (!currentUser) throw new Error("not signed in");
    deals = await queryOrThrow<Deal>(
      isAdmin
        ? `select d.id, d.name, d.asset_class, d.stage, u.name as owner_name
           from deals d join users u on u.id = d.owner_id
           order by d.created_at desc`
        : `select d.id, d.name, d.asset_class, d.stage, u.name as owner_name
           from deals d join users u on u.id = d.owner_id
           where d.owner_id = $1
           order by d.created_at desc`,
      isAdmin ? [] : [currentUser.id]
    );
  } catch (error) {
    loadError =
      error instanceof Error && error.message === "not signed in"
        ? "You must be signed in to view the pipeline."
        : "Couldn't load the pipeline — the database is unreachable. This does not mean your deals are gone; check DATABASE_URL and try again.";
  }

  return (
    <main className="page" style={{ maxWidth: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Pipeline</h1>
        <a href="/" className="btn btn-secondary btn-sm">
          List view
        </a>
      </div>
      {loadError ? <p className="text-danger">{loadError}</p> : <KanbanBoard deals={deals} />}
    </main>
  );
}
