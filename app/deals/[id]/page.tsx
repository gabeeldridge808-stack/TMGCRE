import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { titleCase, STAGE_BADGE_VARIANT, type Stage } from "@/lib/dealConstants";
import { ensureChecklistForStage } from "@/lib/checklist";
import { FIELD_META } from "@/lib/attributeSchemas";
import Badge from "@/app/Badge";
import DealChat from "./DealChat";
import DealDocumentUpload from "./DealDocumentUpload";
import AttributesSection from "./AttributesSection";
import UnderwritingSummary from "./UnderwritingSummary";
import UnderwritingTool from "./UnderwritingTool";
import CondoUnderwritingTool from "./CondoUnderwritingTool";
import DealTabs from "./DealTabs";
import CompsImport from "./CompsImport";
import CompsTable from "./CompsTable";
import AuditLogSection from "./AuditLogSection";
import IcMemoTool from "./IcMemoTool";
import ChecklistSection from "./ChecklistSection";
import DocumentList from "./DocumentList";

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
  source: string | null;
}

interface DocumentFile {
  source_filename: string;
  chunk_count: string;
  drive_file_id: string;
}

interface Comp {
  id: string;
  property_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  sale_date: string | null;
  sale_price: string | null;
  price_per_sqft: string | null;
  price_per_unit: string | null;
  cap_rate: string | null;
  building_sqft: string | null;
  unit_count: string | null;
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

  // Defensive, not just belt-and-suspenders: this covers deals created
  // before checklists existed, which never went through createDeal/
  // updateDeal's seeding. Idempotent and cheap when already seeded.
  await ensureChecklistForStage(deal.id, deal.stage);

  const attributes = await query<DealAttribute>(
    `select key, value, source from deal_attributes where deal_id = $1 order by key`,
    [id]
  );

  const checklistItems = await query<{ id: string; label: string; done: boolean }>(
    `select id, label, done from deal_checklist_items where deal_id = $1 and stage = $2 order by sort_order`,
    [id, deal.stage]
  );

  const files = await query<DocumentFile>(
    `select source_filename, drive_file_id, count(*) as chunk_count
     from documents where deal_id = $1
     group by source_filename, drive_file_id
     order by max(ingested_at) desc`,
    [id]
  );

  const comps = await query<Comp>(
    // to_char, not the raw `date` column — see the same note in
    // app/api/deals/[id]/comps/route.ts.
    `select id, property_name, address, city, state,
            to_char(sale_date, 'YYYY-MM-DD') as sale_date,
            sale_price, price_per_sqft, price_per_unit, cap_rate, building_sqft, unit_count
     from comps where deal_id = $1 order by sale_date desc nulls last, created_at desc`,
    [id]
  );

  const auditEntries = await query<{ id: string; user_name: string; action: string; details: Record<string, unknown>; created_at: string }>(
    `select id, user_name, action, details, created_at from audit_log where deal_id = $1 order by created_at desc limit 100`,
    [id]
  );

  const chatMessages = await query<{ role: "user" | "assistant"; content: string }>(
    `select role, content from chat_messages where deal_id = $1 order by created_at asc`,
    [id]
  );

  // Plain data, not the FIELD_META objects themselves — DealChat is a
  // client component, and passing this as a prop keeps lib/attributeSchemas.ts
  // (Zod + every asset class's schema) out of its bundle entirely.
  const fieldLabels = Object.fromEntries(Object.entries(FIELD_META).map(([key, meta]) => [key, meta.label]));

  const overviewTab = (
    <div>
      <ChecklistSection dealId={deal.id} stage={deal.stage} items={checklistItems} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: "2rem 0 0.75rem" }}>Attributes</h2>
        {attributes.length > 0 && (
          <a href={`/api/deals/${deal.id}/attributes/export`} className="btn btn-secondary btn-sm">
            Export CSV
          </a>
        )}
      </div>
      <AttributesSection attributes={attributes} />

      <h2>Documents</h2>
      <DealDocumentUpload dealId={deal.id} />

      {files.length === 0 ? (
        <p className="text-muted" style={{ marginTop: 12 }}>
          No documents uploaded yet.
        </p>
      ) : (
        <DocumentList dealId={deal.id} files={files} />
      )}

      <p className="text-faint" style={{ marginTop: 12 }}>
        For bulk loading from a Google Drive folder instead, see{" "}
        <code>npm run ingest -- --deal-id {deal.id} --drive-folder-id &lt;folder-id&gt;</code>.
      </p>

      <DealChat dealId={deal.id} initialMessages={chatMessages} fieldLabels={fieldLabels} />
    </div>
  );

  const underwritingTab =
    deal.asset_class === "condo" ? (
      <CondoUnderwritingTool attributes={attributes} />
    ) : (
      <div>
        <UnderwritingSummary attributes={attributes} />
        <UnderwritingTool attributes={attributes} comps={comps} />
      </div>
    );

  const compsTab = (
    <div>
      <CompsImport dealId={deal.id} />
      <CompsTable dealId={deal.id} comps={comps} />
    </div>
  );

  const activityTab = <AuditLogSection entries={auditEntries} />;

  const memoTab = <IcMemoTool dealId={deal.id} />;

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
          { label: "Comps", content: compsTab },
          { label: "IC Memo", content: memoTab },
          { label: "Activity", content: activityTab },
        ]}
      />
    </main>
  );
}
