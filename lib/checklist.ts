// Stage-transition checklists — see the schema.sql comment above
// checklist_templates for the copy-not-reference design.
import { query } from "@/lib/db";

/** Idempotent: no-ops if this deal already has checklist items for this stage. */
export async function ensureChecklistForStage(dealId: string, stage: string): Promise<void> {
  const existing = await query<{ id: string }>(
    `select id from deal_checklist_items where deal_id = $1 and stage = $2 limit 1`,
    [dealId, stage]
  );
  if (existing.length > 0) return;

  const templates = await query<{ label: string; sort_order: number }>(
    `select label, sort_order from checklist_templates where stage = $1 order by sort_order`,
    [stage]
  );
  for (const t of templates) {
    await query(
      `insert into deal_checklist_items (deal_id, stage, label, sort_order) values ($1, $2, $3, $4)`,
      [dealId, stage, t.label, t.sort_order]
    );
  }
}
