// Investment committee memo drafting. Builds on the same deal context
// (attributes, underwriting outputs, comps) already surfaced elsewhere in
// the app — this is the "write it up" step, not a new data source. Output
// is markdown-lite (# headers, ** bold, - bullets) deliberately: it's easy
// for a human to read directly in the browser, and lib/icMemoDocx.ts parses
// that same lightweight structure into a real Word doc for export, so the
// model doesn't need to produce two different formats.
import Anthropic from "@anthropic-ai/sdk";
import type { UnderwritingResults } from "@/lib/underwritingModel";
import type { CondoUnderwritingResults } from "@/lib/condoUnderwritingModel";
import { withAnthropicRetry } from "@/lib/anthropic";

const MODEL = "claude-opus-5";

export const IC_MEMO_SYSTEM_PROMPT = `You are a senior commercial real estate analyst drafting an investment committee memo for this deal. Write the way an analyst at a real estate PE/investment firm actually writes for IC — direct, numbers-forward, and honest about weaknesses, not a sales pitch.

Structure the memo with these sections, each as a markdown "#" header:
# Executive Summary
# Deal Overview
# Market & Comparable Sales
# Financial Underwriting
# Risks & Mitigants
# Recommendation

In Executive Summary: 3-5 sentences — what the deal is, the ask, the headline return metrics, and your bottom-line recommendation.
In Deal Overview: asset class, location, physical characteristics, sponsor/seller context, stage, whatever is recorded.
In Market & Comparable Sales: reference the comps provided (price/SF, price/unit, cap rate) and how this deal's basis compares. If no comps are provided, say so plainly rather than inventing a market view.
In Financial Underwriting: purchase price, financing terms, going-in cap rate, and the pro forma outputs given to you (IRR, equity multiple, cash-on-cash, DSCR) — state them, don't just repeat the raw numbers without a sentence of interpretation (e.g. whether DSCR clears a typical 1.20x lender minimum).
In Risks & Mitigants: the real risks specific to this deal and asset class, each paired with a mitigant if one exists in the data — not generic real estate risk boilerplate.
In Recommendation: a clear go/no-go/proceed-with-conditions call, with the reasoning in one or two sentences.

Only use figures given to you in the deal's attributes, underwriting output, or comps — never invent a number. If a section's normal content isn't available in what you were given (e.g. no comps, no financing terms), say so directly in that section rather than skipping it or filling it with generic filler.`;

export interface MemoDealContext {
  name: string;
  assetClass: string;
  stage: string;
  ownerName: string;
  attributes: { key: string; value: unknown }[];
}

export interface MemoComp {
  property_name: string | null;
  sale_price: string | null;
  price_per_sqft: string | null;
  price_per_unit: string | null;
  cap_rate: string | null;
}

/** Pure formatting of the income-property model's output for the memo prompt. */
export function formatIncomeUnderwritingSummary(u: UnderwritingResults): string {
  return `PRO FORMA UNDERWRITING (single-scenario income model, see the deal's Underwriting tab for assumptions):
- Going-in cap rate: ${u.goingInCapRate.toFixed(2)}%
- Total equity required: $${Math.round(u.equityRequired).toLocaleString()}
- Loan amount: $${Math.round(u.loanAmount).toLocaleString()}
- Year 1 DSCR: ${u.dscr !== null ? u.dscr.toFixed(2) + "x" : "n/a (no debt or missing financing terms)"}
- Average cash-on-cash: ${u.averageCashOnCashPct.toFixed(2)}%
- Unlevered IRR: ${u.unleveredIrrPct !== null ? u.unleveredIrrPct.toFixed(2) + "%" : "n/a"}
- Levered IRR: ${u.leveredIrrPct !== null ? u.leveredIrrPct.toFixed(2) + "%" : "n/a"}
- Equity multiple: ${u.equityMultiple.toFixed(2)}x
- Projected exit sale price: $${Math.round(u.exitSalePrice).toLocaleString()}`;
}

/** Pure formatting of the condo-development model's output for the memo prompt. */
export function formatCondoUnderwritingSummary(u: CondoUnderwritingResults): string {
  return `DEVELOPMENT PRO FORMA (single-scenario build-and-sell model, see the deal's Underwriting tab for assumptions — this is a for-sale development, not an income-producing hold, so there is no cap rate or NOI):
- Total development cost: $${Math.round(u.totalDevelopmentCost).toLocaleString()}
- Construction loan: $${Math.round(u.constructionLoanAmount).toLocaleString()}
- Equity required: $${Math.round(u.equityRequired).toLocaleString()}
- Gross sellout: $${Math.round(u.grossSellout).toLocaleString()}
- Net profit: $${Math.round(u.netProfit).toLocaleString()}
- Profit margin on cost: ${u.profitMarginOnCostPct.toFixed(2)}%
- Equity multiple: ${u.equityMultiple.toFixed(2)}x
- Annualized project IRR: ${u.projectIrrPct !== null ? u.projectIrrPct.toFixed(2) + "%" : "n/a"}
- Total project duration: ${u.totalProjectDurationMonths} months (construction + sales period)`;
}

/** Pure formatting — deal attributes + a pre-formatted underwriting summary + comps into one user turn. */
export function buildMemoUserMessage(deal: MemoDealContext, underwritingSummary: string, comps: MemoComp[]): string {
  const attrLines = deal.attributes.length
    ? deal.attributes.map((a) => `- ${a.key}: ${JSON.stringify(a.value)}`).join("\n")
    : "(none recorded)";

  const compLines = comps.length
    ? comps
        .map((c) => {
          const parts = [
            c.property_name ?? "Unnamed comp",
            c.sale_price ? `$${Number(c.sale_price).toLocaleString()}` : null,
            c.price_per_sqft ? `$${Number(c.price_per_sqft).toFixed(0)}/SF` : null,
            c.price_per_unit ? `$${Number(c.price_per_unit).toLocaleString()}/unit` : null,
            c.cap_rate ? `${Number(c.cap_rate).toFixed(2)}% cap` : null,
          ].filter(Boolean);
          return `- ${parts.join(", ")}`;
        })
        .join("\n")
    : "(no comps imported for this deal)";

  return `DEAL: ${deal.name}
Asset class: ${deal.assetClass} | Stage: ${deal.stage} | Owner: ${deal.ownerName}

RECORDED ATTRIBUTES:
${attrLines}

${underwritingSummary}

COMPARABLE SALES:
${compLines}`;
}

export async function streamIcMemo(deal: MemoDealContext, underwritingSummary: string, comps: MemoComp[]) {
  const userContent = buildMemoUserMessage(deal, underwritingSummary, comps);
  const client = new Anthropic();
  return withAnthropicRetry(async () => {
    return client.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      system: [{ type: "text", text: IC_MEMO_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [{ role: "user", content: userContent }],
    });
  });
}
