// Surfaces closing_date / rate_lock_date attributes (see
// lib/attributeSchemas.ts) as a sorted, countdown-annotated list. Reuses
// parseDate from lib/compsImport.ts — both need "turn a loosely-formatted
// date string into ISO," and there's no reason to have two implementations
// of that. Attribute date fields are free-text (extracted from documents,
// not user-typed into a date picker), so a value like "TBD" or "Q2 2026"
// simply doesn't produce an entry — no error, just skipped.
import { parseDate } from "@/lib/compsImport";

export interface DateAttributeRow {
  deal_id: string;
  deal_name: string;
  key: string;
  value: unknown;
}

export interface KeyDateEntry {
  dealId: string;
  dealName: string;
  label: string;
  date: string;
  daysUntil: number;
}

const LABELS: Record<string, string> = {
  closing_date: "Closing",
  rate_lock_date: "Rate Lock",
};

/** Pure: parses whatever's parseable and sorts soonest (or most overdue) first. */
export function buildKeyDates(rows: DateAttributeRow[], today: Date = new Date()): KeyDateEntry[] {
  const entries: KeyDateEntry[] = [];
  for (const row of rows) {
    const label = LABELS[row.key];
    if (!label || typeof row.value !== "string") continue;
    const iso = parseDate(row.value);
    if (!iso) continue;
    const daysUntil = Math.round((new Date(`${iso}T00:00:00Z`).getTime() - today.getTime()) / 86_400_000);
    entries.push({ dealId: row.deal_id, dealName: row.deal_name, label, date: iso, daysUntil });
  }
  return entries.sort((a, b) => a.daysUntil - b.daysUntil);
}
