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
    <main style={{ padding: 32, maxWidth: 480, margin: "0 auto" }}>
      <p>
        <a href={`/deals/${deal.id}`}>&larr; {deal.name}</a>
      </p>
      <h1>Edit Deal</h1>
      <EditDealForm dealId={deal.id} initial={deal} />
    </main>
  );
}
