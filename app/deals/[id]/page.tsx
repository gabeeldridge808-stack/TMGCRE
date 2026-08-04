import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import DealChat from "./DealChat";
import DealDocumentUpload from "./DealDocumentUpload";

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

interface DocumentFile {
  source_filename: string;
  chunk_count: string;
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

  const files = await query<DocumentFile>(
    `select source_filename, count(*) as chunk_count
     from documents where deal_id = $1
     group by source_filename
     order by max(ingested_at) desc`,
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
      <DealDocumentUpload dealId={deal.id} />

      {files.length === 0 ? (
        <p style={{ color: "#666", marginTop: 12 }}>No documents uploaded yet.</p>
      ) : (
        <ul style={{ marginTop: 12 }}>
          {files.map((f) => (
            <li key={f.source_filename}>
              {f.source_filename} — {f.chunk_count} chunk(s)
            </li>
          ))}
        </ul>
      )}

      <p style={{ color: "#999", fontSize: 13, marginTop: 12 }}>
        For bulk loading from a Google Drive folder instead, see{" "}
        <code>npm run ingest -- --deal-id {deal.id} --drive-folder-id &lt;folder-id&gt;</code>.
      </p>

      <DealChat dealId={deal.id} />
    </main>
  );
}
