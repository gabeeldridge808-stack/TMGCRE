import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import DealChat from "./DealChat";

export const dynamic = "force-dynamic";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

interface DealAttribute {
  key: string;
  value: unknown;
}

export default async function DealWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [deal] = await query<Deal>(`select * from deals where id = $1`, [id]);
  if (!deal) {
    notFound();
  }

  const attributes = await query<DealAttribute>(
    `select key, value from deal_attributes where deal_id = $1 order by key`,
    [id]
  );

  const [{ chunk_count, file_count }] = await query<{
    chunk_count: string;
    file_count: string;
  }>(
    `select count(*) as chunk_count, count(distinct drive_file_id) as file_count
     from documents where deal_id = $1`,
    [id]
  );

  return (
    <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <p>
        <a href="/">&larr; Portfolio</a>
      </p>
      <h1>{deal.name}</h1>
      <p>
        {deal.asset_class} &middot; {deal.stage} &middot; owner: {deal.owner}
      </p>

      <h2>Attributes</h2>
      {attributes.length === 0 ? (
        <p>No type-specific attributes recorded yet.</p>
      ) : (
        <dl>
          {attributes.map((attr) => (
            <div key={attr.key} style={{ marginBottom: 4 }}>
              <dt style={{ fontWeight: 600, display: "inline" }}>{attr.key}: </dt>
              <dd style={{ display: "inline" }}>{JSON.stringify(attr.value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <h2>Documents</h2>
      <p>
        {file_count} file(s) ingested, {chunk_count} indexed chunk(s).
      </p>
      <p style={{ color: "#666" }}>
        Run <code>npm run ingest -- --deal-id {deal.id} --drive-folder-id &lt;folder-id&gt;</code> to
        ingest documents for this deal, or <code>npm run search -- --deal-id {deal.id} --query &quot;...&quot;</code>{" "}
        to test retrieval.
      </p>

      <DealChat dealId={deal.id} />
    </main>
  );
}
