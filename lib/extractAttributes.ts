// Attribute extraction: after a deal's documents are ingested, ask Claude to
// pull structured fields (unit count, cap rate, purchase price, whatever's
// explicit in the text) out of the raw extracted text and write them to
// deal_attributes. Insert-only (see writeNewAttributes) — re-ingesting a
// folder, or a later extraction pass finding the same fact again, can never
// silently overwrite a value a human already entered or corrected.
import Anthropic from "@anthropic-ai/sdk";
import { query } from "@/lib/db";

const MODEL = "claude-opus-5";

// Bounds a single one-shot extraction call. An OM-heavy deal room can run to
// hundreds of pages; 300k chars (~75k tokens) covers a normal diligence
// packet without approaching context-window or per-call cost extremes.
const MAX_EXTRACTION_CHARS = 300_000;

const EXTRACTION_SYSTEM_PROMPT = `You extract structured underwriting data from commercial real estate documents (OMs, rent rolls, T-12s, appraisals) for a deal-tracking database.

Only record a fact if it is explicitly stated in the provided text — never estimate, infer a "typical" value, or fill in a field the document doesn't actually contain. It's correct and expected to extract nothing from a document that doesn't contain underwriting data (a lease abstract, a legal notice, a cover letter).

Use short, snake_case keys a database column would use (purchase_price, cap_rate, unit_count, noi, occupancy_pct, year_built, revpar, adr, room_count, acreage, zoning, entitlement_status, square_footage, wault_years, ...) — prefer a key already in use over inventing a near-duplicate for the same fact. Use plain numbers for numeric values (no "$", ",", or "%" characters) and state them exactly as the source does — don't convert units or normalize a percentage to a fraction. For a repeated structure like unit mix or a tenant roster, use one key (e.g. unit_mix, tenant_roster) with an array value.

Call record_attributes exactly once. If nothing in the provided text is extractable, call it with an empty array — don't skip the tool call.`;

const RECORD_ATTRIBUTES_TOOL = {
  name: "record_attributes",
  description: "Record the structured underwriting facts found in the provided documents.",
  input_schema: {
    type: "object" as const,
    properties: {
      attributes: {
        type: "array",
        description: "One entry per distinct fact found. Empty array if nothing extractable was found.",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "snake_case field name" },
            value: {
              description:
                "The value as stated in the source — a number, string, boolean, or an array/object for structured data like a unit mix.",
            },
            source_filename: { type: "string", description: "Which document this came from" },
          },
          required: ["key", "value", "source_filename"],
        },
      },
    },
    required: ["attributes"],
  },
};

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
    ? `Already recorded for this deal (don't re-extract these): ${existingKeys.join(", ")}`
    : `Nothing has been recorded for this deal yet.`;

  const docLines = documents.map((d) => `--- ${d.filename} ---\n${d.text}`).join("\n\n");

  return `Asset class: ${assetClass}\n${knownLine}\n\n${docLines}`;
}

/** Calls Claude once to extract attributes from the given document text. */
export async function extractAttributesFromText(
  assetClass: string,
  existingKeys: string[],
  documents: SourceDocument[]
): Promise<ExtractedAttribute[]> {
  const client = new Anthropic();
  const budgeted = capToCharBudget(documents, MAX_EXTRACTION_CHARS);
  const prompt = buildExtractionPrompt(assetClass, existingKeys, budgeted);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: EXTRACTION_SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    tools: [RECORD_ATTRIBUTES_TOOL],
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return [];

  const input = toolUse.input as { attributes?: ExtractedAttribute[] };
  return input.attributes ?? [];
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
