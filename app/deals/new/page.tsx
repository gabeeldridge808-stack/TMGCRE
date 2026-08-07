import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import NewDealForm from "./NewDealForm";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  // Only admins get an owner picker — an analyst's deals are always their
  // own, so there's nothing to pick. Fetching the full user list isn't
  // worth gating behind isAdmin here too; it's small and non-sensitive.
  const users = isAdmin
    ? await query<{ id: string; name: string }>(`select id, name from users order by name`)
    : [];

  return (
    <main className="page page-narrow">
      <h1 style={{ marginBottom: 24 }}>New Deal</h1>
      <NewDealForm isAdmin={isAdmin} users={users} currentUserId={currentUser?.id ?? ""} />
    </main>
  );
}
