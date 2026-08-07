// Append-only activity log — who changed what, when (schema.sql: audit_log).
// Best-effort by design: recordAuditLog uses query() (swallows DB errors),
// not queryOrThrow, because a logging failure must never block or fail the
// user-facing action it's describing. Losing an audit entry on a rare DB
// hiccup is an acceptable tradeoff for an internal tool; failing someone's
// deal edit because logging that edit failed would not be.
import { query } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export type AuditAction =
  | "deal.created"
  | "deal.updated"
  | "deal.deleted"
  | "document.uploaded"
  | "comps.imported"
  | "comps.deleted"
  | "attribute.confirmed_via_chat"
  | "development.updated"
  | "milestone.added"
  | "milestone.updated"
  | "milestone.deleted"
  | "condo_unit_sales.logged";

export interface AuditLogEntry {
  dealId?: string | null;
  action: AuditAction;
  details?: Record<string, unknown>;
}

export async function recordAuditLog(user: SessionUser, entry: AuditLogEntry): Promise<void> {
  await query(
    `insert into audit_log (deal_id, user_id, user_name, action, details) values ($1, $2, $3, $4, $5)`,
    [entry.dealId ?? null, user.id, user.name, entry.action, JSON.stringify(entry.details ?? {})]
  );
}

const ACTION_LABELS: Record<AuditAction, string> = {
  "deal.created": "created this deal",
  "deal.updated": "updated this deal",
  "deal.deleted": "deleted this deal",
  "document.uploaded": "uploaded a document",
  "comps.imported": "imported comps",
  "comps.deleted": "deleted a comp",
  "attribute.confirmed_via_chat": "confirmed a chat-proposed attribute",
  "development.updated": "updated development details",
  "milestone.added": "added a milestone",
  "milestone.updated": "updated a milestone",
  "milestone.deleted": "deleted a milestone",
  "condo_unit_sales.logged": "logged a unit-sales snapshot",
};

/** Pure: human-readable label for an audit action, falling back to the raw string for forward-compat with an action added later. */
export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action as AuditAction] ?? action;
}
