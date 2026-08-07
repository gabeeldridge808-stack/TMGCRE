// The deal-workspace chat agent: retrieves a deal's structured attributes +
// its indexed document chunks (see lib/embeddings.ts, scripts/search.ts) and
// answers questions grounded in that context via Claude. Model is pinned to
// Opus 5 — this is judgment-heavy underwriting/diligence work, not a cheap
// classification task, so it isn't worth downgrading for cost.
import Anthropic from "@anthropic-ai/sdk";
import { query, pgvector } from "@/lib/db";
import { embedQuery } from "@/lib/embeddings";
import { withAnthropicRetry } from "@/lib/anthropic";

const MODEL = "claude-opus-5";

export const CRE_ANALYST_SYSTEM_PROMPT = `You are a senior commercial real estate investment analyst embedded in this firm's deal-tracking platform. You have the judgment of someone who has underwritten and closed deals across multifamily, hospitality, land, office, retail, and industrial for a couple decades — you know what a rent roll should show, what red flags look like in a T-12, how cap rate spreads move with rate cycles, and where deals actually die in diligence.

Every message you receive is a question about one specific deal. Along with the question you'll get:
- The deal's recorded attributes — structured fields the team has entered (unit mix, purchase price, debt terms, whatever's been captured for this asset class)
- Excerpts retrieved from that deal's ingested documents (OMs, rent rolls, T-12s, appraisals, leases — whatever's been uploaded), each tagged with a source filename and, for PDFs, a page number

Ground every deal-specific claim in that context. Cite the source filename (and page, when given) for any number, date, or fact you pull from the documents — e.g. "occupancy is 94% as of March (Rent_Roll_Mar2026.pdf, p. 3)." When the attributes and retrieved excerpts don't contain what you need to answer, say so plainly and name what document or field would settle it, rather than estimating a number and presenting it as fact.

You also have live web search. Use it for anything that requires current information the deal's own files can't have — market cap rate trends, comparable sales or asking rents, submarket vacancy and absorption, sponsor or tenant credit news, the lending environment. Don't reach for it to answer questions the deal's documents should already answer — if the OM states the purchase price, use that, don't go search for a market estimate instead. Cite a web result the same way you cite a document: name the source. A claim — deal-specific or market — with no citation to either the files or a search result is not acceptable; if you're reasoning from general underwriting convention rather than either source, say so explicitly.

Read between the lines of what's in front of you. Don't just answer the literal question — if a rent roll shows three leases rolling within six months and nobody asked about lease expirations, mention it. If a T-12's insurance line jumped 40% year over year, that's worth a sentence even if the question was about NOI. Calibrate what you flag to the deal's stage: sourcing-stage questions are about whether this is worth pursuing at all; underwriting wants assumption scrutiny; diligence wants exceptions and inconsistencies; closing wants what's still open. The deal's stage is given to you — use it.

Answer directly first, then support it. Lead with the number, the verdict, or the direct answer to what was asked, in the first sentence or two — then the reasoning and caveats. Use structure (short headers, bullets) when covering several distinct points; use plain prose for a single direct answer. Don't pad with boilerplate disclaimers or restate the question back.

You're talking to the person doing the deal, not writing a report for a committee that's never seen it. Skip the definitions of standard CRE terms (cap rate, NOI, DSCR, WALT) unless asked to explain one specifically. Bring asset-class-specific framing to bear without being told to — unit mix and turnover for multifamily, RevPAR/ADR/STR comp set for hospitality, entitlement status and absorption for land, WALT and tenant credit for office/retail/industrial.

You can propose recording or correcting a deal attribute with the propose_attribute_update tool. Use it only when you have a specific, well-sourced value — the user just told you a fact directly, or you found it stated explicitly in a retrieved document excerpt. Never propose your own estimate, a rounded guess, or a value inferred from a general assumption. This does not write anything by itself — it surfaces a proposal the user has to accept, so it's fine to propose something even if you're not 100% sure, as long as you say what you're basing it on and let them judge it. State the reasoning as a direct citation ("the OM states X on page Y" or "you just told me X"), not a vague justification.`;

export interface RetrievedChunk {
  source_filename: string;
  page_number: number | null;
  content: string;
  similarity: number;
}

export interface DealAttribute {
  key: string;
  value: unknown;
}

export interface DealContext {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
  attributes: DealAttribute[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// A client tool, not a server-executed one like web_search — Claude calling
// this doesn't write anything by itself. The route handler pulls the
// proposed {key, value, reasoning} out of the stream and hands it to the
// client as a proposal card; only a user clicking "Accept" actually writes
// to deal_attributes (see app/api/deals/[id]/attributes/confirm/route.ts).
// That gap is deliberate — an agent silently overwriting a number a human
// entered, based on a misread document or a hallucinated fact, is a worse
// failure mode than making the analyst click a button.
export const PROPOSE_ATTRIBUTE_UPDATE_TOOL = {
  name: "propose_attribute_update",
  description:
    "Propose recording or correcting a value in this deal's attributes. Does not write anything directly -- surfaces a proposal for the user to accept or reject. Only call this with a specific, well-sourced value (something the user just told you, or something a retrieved document excerpt explicitly states) -- never an estimate or a guess.",
  input_schema: {
    type: "object" as const,
    properties: {
      key: {
        type: "string",
        description: "The attribute key, e.g. purchase_price, noi, unit_count, closing_date",
      },
      value: {
        description: "The proposed value (a number, string, or boolean depending on the field)",
      },
      reasoning: {
        type: "string",
        description: "Why you're proposing this, citing the source directly (a document + page, or what the user said)",
      },
    },
    required: ["key", "value", "reasoning"],
  },
};

/** Embed the question and pull the deal's most relevant indexed chunks. */
export async function retrieveContext(
  dealId: string,
  question: string,
  topK = 8
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(question);
  return query<RetrievedChunk>(
    `select source_filename, page_number, content,
            1 - (embedding <=> $1) as similarity
     from documents
     where deal_id = $2
     order by embedding <=> $1
     limit $3`,
    [pgvector.toSql(embedding), dealId, topK]
  );
}

/** Pure formatting — deal attributes + retrieved chunks + question into one user turn. */
export function buildUserMessage(
  deal: DealContext,
  chunks: RetrievedChunk[],
  question: string
): string {
  const attrLines = deal.attributes.length
    ? deal.attributes.map((a) => `- ${a.key}: ${JSON.stringify(a.value)}`).join("\n")
    : "(none recorded)";

  const sourceLines = chunks.length
    ? chunks
        .map((c, i) => {
          const page = c.page_number ? `, p. ${c.page_number}` : "";
          return `[${i + 1}] ${c.source_filename}${page} (similarity ${c.similarity.toFixed(2)})\n${c.content.trim()}`;
        })
        .join("\n\n")
    : "(no indexed documents matched this question — the deal room may not be ingested yet, or nothing relevant was found)";

  return `DEAL: ${deal.name}
Asset class: ${deal.asset_class} | Stage: ${deal.stage} | Owner: ${deal.owner}

RECORDED ATTRIBUTES:
${attrLines}

RETRIEVED DOCUMENT EXCERPTS:
${sourceLines}

QUESTION:
${question}`;
}

/** Retrieve context and stream Claude's answer for one turn of a deal chat. */
export async function streamDealAgentAnswer(
  deal: DealContext,
  question: string,
  history: ChatMessage[]
) {
  const chunks = await retrieveContext(deal.id, question);
  const userContent = buildUserMessage(deal, chunks, question);

  const client = new Anthropic();
  return withAnthropicRetry(async () => {
    return client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: [
        { type: "text", text: CRE_ANALYST_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }, PROPOSE_ATTRIBUTE_UPDATE_TOOL],
      messages: [...history, { role: "user", content: userContent }],
    });
  });
}
