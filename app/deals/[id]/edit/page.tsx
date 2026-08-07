import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessDeal } from "@/lib/dealAccess";
import EditDealForm from "./EditDealForm";

export const dynamic = "force-dynamic";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner_id: string;
}

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [deal] = await query<Deal>(`select id, name, asset_class, stage, owner_id from deals where id = $1`, [id]);
  if (!deal) {
    notFound();
  }

  const currentUser = await getCurrentUser();
  if (!currentUser || !canAccessDeal(currentUser, deal.owner_id)) {
    return (
      <main className="page page-narrow">
        <p className="text-danger">You don&apos;t have access to this deal.</p>
      </main>
    );
  }

  const isAdmin = currentUser.role === "admin";
  const users = isAdmin
    ? await query<{ id: string; name: string }>(`select id, name from users order by name`)
    : [];

  return (
    <main className="page page-narrow">
      <a href={`/deals/${deal.id}`} className="back-link">
        &larr; {deal.name}
      </a>
      <h1 style={{ marginBottom: 24 }}>Edit Deal</h1>
      <EditDealForm dealId={deal.id} initial={deal} isAdmin={isAdmin} users={users} />
    </main>
  );
}
