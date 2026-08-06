import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import EditDealForm from "./EditDealForm";

export const dynamic = "force-dynamic";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [deal] = await query<Deal>(`select id, name, asset_class, stage, owner from deals where id = $1`, [id]);
  if (!deal) {
    notFound();
  }

  return (
    <main className="page page-narrow">
      <a href={`/deals/${deal.id}`} className="back-link">
        &larr; {deal.name}
      </a>
      <h1 style={{ marginBottom: 24 }}>Edit Deal</h1>
      <EditDealForm dealId={deal.id} initial={deal} />
    </main>
  );
}
