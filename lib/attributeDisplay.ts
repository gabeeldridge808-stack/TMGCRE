// Pure formatting/grouping helpers for rendering deal_attributes rows using
// the FIELD_META registry (lib/attributeSchemas.ts) — grouped sections with
// human labels and units instead of a raw key: value dump. Falls back
// gracefully for any key not in FIELD_META (e.g. a manually-entered field
// that predates the schema, or a typo) so nothing silently disappears.
import { FIELD_META, type FieldMeta } from "@/lib/attributeSchemas";

export interface DisplayAttribute {
  key: string;
  label: string;
  unit?: FieldMeta["unit"];
  value: unknown;
}

export interface AttributeGroup {
  group: string;
  items: DisplayAttribute[];
}

const GROUP_ORDER = [
  "Acquisition",
  "Returns",
  "Financing",
  "Operations",
  "Physical",
  "Location",
  "Multifamily",
  "Office",
  "Retail",
  "Industrial",
  "Hospitality",
  "Land",
  "Condo Development",
  "Other",
];

export function groupAttributesForDisplay(
  attributes: { key: string; value: unknown }[]
): AttributeGroup[] {
  const byGroup = new Map<string, DisplayAttribute[]>();

  for (const attr of attributes) {
    const meta = FIELD_META[attr.key];
    const group = meta?.group ?? "Other";
    const label = meta?.label ?? attr.key;
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push({ key: attr.key, label, unit: meta?.unit, value: attr.value });
  }

  const groups: AttributeGroup[] = [];
  for (const groupName of GROUP_ORDER) {
    const items = byGroup.get(groupName);
    if (items?.length) {
      items.sort((a, b) => a.label.localeCompare(b.label));
      groups.push({ group: groupName, items });
      byGroup.delete(groupName);
    }
  }
  // Anything left over isn't in GROUP_ORDER — shouldn't happen given the
  // coverage test in attributeSchemas.test.ts, but don't drop data if it does.
  for (const [group, items] of byGroup) {
    items.sort((a, b) => a.label.localeCompare(b.label));
    groups.push({ group, items });
  }

  return groups;
}

/** True for an array of objects (unit_mix, rent_roll, anchor_tenants, ...) — rendered as a table. */
export function isRowShaped(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === "object" && v !== null && !Array.isArray(v))
  );
}

export function formatScalar(value: unknown, unit?: FieldMeta["unit"]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (unit === "$") return `$${value.toLocaleString()}`;
    if (unit === "%") return `${value}%`;
    if (unit === "x") return `${value}x`;
    if (unit) return `${value} ${unit}`;
    return value.toLocaleString();
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Column headers for a row-shaped value — the union of keys across all rows, in first-seen order. */
export function rowTableColumns(rows: Record<string, unknown>[]): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return columns;
}
