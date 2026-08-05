// Attribute extraction: after a deal's documents are ingested, ask Claude to
// fill the deal's asset-class attribute schema (lib/attributeSchemas.ts)
// from the newly-extracted text and write whatever it finds to
// deal_attributes. Insert-only (see writeNewAttributes) — re-ingesting a
// folder, or a later extraction pass finding the same fact again, can never
// silently overwrite a value a human already entered or corrected.
//
// Uses Claude's structured outputs (client.messages.parse + a Zod schema)
// rather than a free-form tool call: the model fills the exact typed shape
// for the deal's asset class (unit_mix rows, rent_roll rows, t12_noi, ...)
// instead of inventing its own key names. This is what makes a rent roll
// or T-12 upload populate the schema's row-shaped fields correctly instead
// of a flat list of loosely-named facts.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { query } from "@/lib/db";
import { getSchemaSectionsForAssetClass } from "@/lib/attributeSchemas";

const MODEL = "claude-opus-5";

// Bounds a single one-shot extraction call. An OM-heavy deal room can run to
// hundreds of pages; 300k chars (~75k tokens) covers a normal diligence
// packet without approaching context-window or per-call cost extremes.
const MAX_EXTRACTION_CHARS = 300_000;

const EXTRACTION_SYSTEM_PROMPT = `You extract structured underwriting data from commercial real estate documents (OMs, rent rolls, T-12s, appraisals, leases) into the given schema for a deal-tracking database.

Only fill a field if it is explicitly stated in the provided text — never estimate, infer a "typical" value, or fill in a field the document doesn't actually contain. Leave a field out entirely if it isn't in the text; it's correct and expected to fill nothing from a document that doesn't contain underwriting data (a lease abstract, a legal notice, a cover letter). Do not round or convert units — use the number and unit exactly as the source states it (e.g. if a rent roll gives monthly rent per unit, that is what avg_in_place_rent means; don't annualize it).

For row-shaped fields (unit_mix, rent_roll, anchor_tenants), include one row per distinct unit type / tenant / lease actually listed in the document — don't summarize multiple rows into one, and don't fabricate a row for a unit type or tenant not present in the text.`;

export interface ExtractedAttribute {
  key: string;
  value: unknown;
  source_filename: string;
}

export interface SourceDocument {
  filename: string;
  text: string;
}

/** Pure: caps combined document text to a character budget, truncating the tail. */
export function capToCharBudget(documents: SourceDocument[], budget: number): SourceDocument[] {
  let remaining = budget;
  const out: SourceDocument[] = [];
  for (const doc of documents) {
    if (remaining <= 0) break;
    if (doc.text.length <= remaining) {
      out.push(doc);
      remaining -= doc.text.length;
    } else {
      out.push({ filename: doc.filename, text: doc.text.slice(0, remaining) + "\n[...truncated...]" });
      remaining = 0;
    }
  }
  return out;
}

/** Pure: builds the one user turn sent for extraction. */
export function buildExtractionPrompt(
  assetClass: string,
  existingKeys: string[],
  documents: SourceDocument[]
): string {
  const knownLine = existingKeys.length
    ? `Already recorded for this deal (you may still fill these if the documents restate them, but don't invent values for other fields just because these are known): ${existingKeys.join(", ")}`
    : `Nothing has been recorded for this deal yet.`;

  const docLines = documents.map((d) => `--- ${d.filename} ---\n${d.text}`).join("\n\n");

  return `Asset class: ${assetClass}\n${knownLine}\n\n${docLines}`;
}

/**
 * Fills the asset class's attribute schema from the given document text —
 * one Claude call per schema section (see lib/attributeSchemas.ts for why
 * it's split into sections rather than one big schema) — and returns the
 * combined result across all sections. Falls back to an empty result for
 * an asset class with no schema (shouldn't happen given schema.sql's check
 * constraint, but a lookup miss shouldn't crash ingestion).
 */
export async function extractAttributesFromText(
  assetClass: string,
  existingKeys: string[],
  documents: SourceDocument[]
): Promise<ExtractedAttribute[]> {
  const sections = getSchemaSectionsForAssetClass(assetClass);
  if (!sections) return [];

  const client = new Anthropic();
  const budgeted = capToCharBudget(documents, MAX_EXTRACTION_CHARS);
  const prompt = buildExtractionPrompt(assetClass, existingKeys, budgeted);
  const sourceFilename = documents.map((d) => d.filename).join(", ");

  const sectionResults = await Promise.all(
    sections.map(async (section) => {
      const message = await client.messages.parse({
        model: MODEL,
        max_tokens: 8192,
        system: EXTRACTION_SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        // "low" — this is bounded pattern-matching against an explicit
        // schema, not open-ended reasoning, and it runs 3x in parallel per
        // upload inside a request with a hard duration ceiling (see the
        // maxDuration comment in the API route) — "medium" measurably
        // pushed real requests over that ceiling.
        output_config: { effort: "low", format: zodOutputFormat(section.schema) },
        messages: [{ role: "user", content: prompt }],
      });
      return message.parsed_output;
    })
  );

  const attributes: ExtractedAttribute[] = [];
  for (const parsed of sectionResults) {
    if (!parsed) continue;
    for (const [key, value] of Object.entries(parsed)) {
      if (value === undefined || value === null) continue;
      attributes.push({ key, value, source_filename: sourceFilename });
    }
  }
  return attributes;
}

/** Insert-only — never overwrites an attribute that already has a value. */
export async function writeNewAttributes(
  dealId: string,
  attributes: ExtractedAttribute[]
): Promise<{ key: string; inserted: boolean }[]> {
  const results: { key: string; inserted: boolean }[] = [];
  for (const attr of attributes) {
    const rows = await query<{ key: string }>(
      `insert into deal_attributes (deal_id, key, value)
       values ($1, $2, $3)
       on conflict (deal_id, key) do nothing
       returning key`,
      [dealId, attr.key, JSON.stringify(attr.value)]
    );
    results.push({ key: attr.key, inserted: rows.length > 0 });
  }
  return results;
}
