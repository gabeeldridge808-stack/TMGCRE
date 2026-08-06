// Turns a CSV comps export (e.g. CoStar's "export search results to CSV",
// a normal feature of a CoStar subscription — see the design note in
// schema.sql for why this is a file import and not an automated scrape)
// into normalized comp records. Column names in a comps export vary by
// provider and by which columns the user chose to include, so this guesses
// a mapping from CSV headers to known fields and lets the caller confirm/
// adjust it before import — never assumes a fixed CoStar column schema.
import Papa from "papaparse";

export interface CompField {
  key: string;
  label: string;
  type: "text" | "number" | "date";
}

export const COMP_FIELDS: CompField[] = [
  { key: "property_name", label: "Property Name", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "asset_class", label: "Property Type", type: "text" },
  { key: "sale_date", label: "Sale Date", type: "date" },
  { key: "sale_price", label: "Sale Price", type: "number" },
  { key: "price_per_sqft", label: "Price / SF", type: "number" },
  { key: "price_per_unit", label: "Price / Unit", type: "number" },
  { key: "cap_rate", label: "Cap Rate (%)", type: "number" },
  { key: "building_sqft", label: "Building SF", type: "number" },
  { key: "unit_count", label: "Unit Count", type: "number" },
  { key: "year_built", label: "Year Built", type: "number" },
  { key: "buyer", label: "Buyer", type: "text" },
  { key: "seller", label: "Seller", type: "text" },
];

const NUMERIC_FIELDS = new Set(COMP_FIELDS.filter((f) => f.type === "number").map((f) => f.key));

// Checked in this order per header — most specific first, so e.g. "Price/SF"
// matches price_per_sqft before the generic "price" keyword (on sale_price)
// gets a chance to claim it.
const FIELD_KEYWORDS: { key: string; keywords: string[] }[] = [
  { key: "price_per_sqft", keywords: ["price sf", "price per sf", "psf", "sf price", "price square"] },
  { key: "price_per_unit", keywords: ["price unit", "per unit", "unit price"] },
  { key: "cap_rate", keywords: ["cap rate", "cap rt", "caprate"] },
  { key: "sale_price", keywords: ["sale price", "sold price", "purchase price", "transaction price", "price"] },
  { key: "building_sqft", keywords: ["building sf", "rba", "total sf", "gla", "square feet", "sqft", "building size"] },
  { key: "unit_count", keywords: ["units", "unit count", "no of units", "number of units"] },
  { key: "year_built", keywords: ["year built", "yr built", "built"] },
  { key: "sale_date", keywords: ["sale date", "sold date", "close date", "closing date", "transaction date"] },
  { key: "buyer", keywords: ["buyer"] },
  { key: "seller", keywords: ["seller"] },
  { key: "asset_class", keywords: ["property type", "secondary type", "asset type", "asset class", "building type"] },
  { key: "state", keywords: ["state"] },
  { key: "city", keywords: ["city"] },
  { key: "address", keywords: ["address"] },
  { key: "property_name", keywords: ["property name", "building name", "name"] },
];

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Pure: parses raw CSV text into headers + row objects (Papa Parse under the hood). */
export function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return { headers: result.meta.fields ?? [], rows: result.data };
}

/** Pure: best-guess mapping from CSV header -> comp field key (or null if no confident guess). */
export function guessColumnMapping(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let matched: string | null = null;
    for (const { key, keywords } of FIELD_KEYWORDS) {
      if (keywords.some((kw) => normalized.includes(kw))) {
        matched = key;
        break;
      }
    }
    mapping[header] = matched;
  }
  return mapping;
}

/** Pure: strips currency/percent/comma formatting and parses a number. Returns undefined if not parseable. */
export function parseNumeric(raw: string): number | undefined {
  const cleaned = raw.replace(/[$,%\s]/g, "");
  if (cleaned === "") return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

/** Pure: parses a variety of common date formats into an ISO date string (YYYY-MM-DD). */
export function parseDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

export interface NormalizedComp {
  property_name?: string;
  address?: string;
  city?: string;
  state?: string;
  asset_class?: string;
  sale_date?: string;
  sale_price?: number;
  price_per_sqft?: number;
  price_per_unit?: number;
  cap_rate?: number;
  building_sqft?: number;
  unit_count?: number;
  year_built?: number;
  buyer?: string;
  seller?: string;
  extra: Record<string, string>;
}

/**
 * Pure: applies a header->field mapping to parsed CSV rows. Unmapped
 * (or mapping === null) columns are kept in `extra` rather than dropped,
 * so a comp export with columns this schema doesn't model yet still
 * preserves that data.
 */
export function coerceRowsToComps(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>
): NormalizedComp[] {
  return rows.map((row) => {
    const comp: NormalizedComp = { extra: {} };
    for (const [header, rawValue] of Object.entries(row)) {
      const value = (rawValue ?? "").trim();
      const fieldKey = mapping[header];

      if (!fieldKey) {
        if (value) comp.extra[header] = value;
        continue;
      }
      if (!value) continue;

      if (fieldKey === "sale_date") {
        const parsed = parseDate(value);
        if (parsed) comp.sale_date = parsed;
      } else if (NUMERIC_FIELDS.has(fieldKey)) {
        const parsed = parseNumeric(value);
        if (parsed !== undefined) (comp as unknown as Record<string, unknown>)[fieldKey] = parsed;
      } else {
        (comp as unknown as Record<string, unknown>)[fieldKey] = value;
      }
    }
    return comp;
  });
}
