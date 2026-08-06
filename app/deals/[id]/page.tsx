import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { titleCase, STAGE_BADGE_VARIANT, type Stage } from "@/lib/dealConstants";
import Badge from "@/app/Badge";
import DealChat from "./DealChat";
import DealDocumentUpload from "./DealDocumentUpload";
import AttributesSection from "./AttributesSection";
import UnderwritingSummary from "./UnderwritingSummary";
import UnderwritingTool from "./UnderwritingTool";
import DealTabs from "./DealTabs";

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

  const overviewTab = (
    <div>
      <h2>Attributes</h2>
      <AttributesSection attributes={attributes} />

      <h2>Documents</h2>
      <DealDocumentUpload dealId={deal.id} />

      {files.length === 0 ? (
        <p className="text-muted" style={{ marginTop: 12 }}>
          No documents uploaded yet.
        </p>
      ) : (
        <ul style={{ marginTop: 12, paddingLeft: 20 }}>
          {files.map((f) => (
            <li key={f.source_filename}>
              {f.source_filename} — {f.chunk_count} chunk(s)
            </li>
          ))}
        </ul>
      )}

      <p className="text-faint" style={{ marginTop: 12 }}>
        For bulk loading from a Google Drive folder instead, see{" "}
        <code>npm run ingest -- --deal-id {deal.id} --drive-folder-id &lt;folder-id&gt;</code>.
      </p>

      <DealChat dealId={deal.id} />
    </div>
  );

  const underwritingTab = (
    <div>
      <UnderwritingSummary attributes={attributes} />
      <UnderwritingTool attributes={attributes} />
    </div>
  );

  return (
    <main className="page">
      <a href="/" className="back-link">
        &larr; Portfolio
      </a>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1>{deal.name}</h1>
        <a href={`/deals/${deal.id}/edit`} className="btn btn-secondary btn-sm">
          Edit
        </a>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 24 }}>
        <Badge variant="neutral">{titleCase(deal.asset_class)}</Badge>
        <Badge variant={STAGE_BADGE_VARIANT[deal.stage as Stage] ?? "neutral"}>{titleCase(deal.stage)}</Badge>
        <span className="text-muted" style={{ fontSize: 14 }}>
          owner: {deal.owner}
        </span>
      </div>

      <DealTabs
        tabs={[
          { label: "Overview", content: overviewTab },
          { label: "Underwriting", content: underwritingTab },
        ]}
      />
    </main>
  );
}
