// TEMPORARY diagnostic route — not part of the product, delete after use.
// Times Claude's structured-outputs "grammar compilation" for each
// multifamily schema section (plus a trivial control schema) in parallel,
// to isolate which section is behind the "Grammar compilation timed out"
// failure seen in production.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ASSET_CLASS_SECTIONS } from "@/lib/attributeSchemas";

export const maxDuration = 300;

const client = new Anthropic();

async function timeIt(label: string, schema: z.ZodType) {
  const start = Date.now();
  try {
    const message = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: "Extract data from the text.",
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      messages: [{ role: "user", content: "Purchase price is $10,000,000, closing March 2026." }],
    });
    return { label, ok: true, seconds: (Date.now() - start) / 1000, output: message.parsed_output };
  } catch (error) {
    return {
      label,
      ok: false,
      seconds: (Date.now() - start) / 1000,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const control = z.object({ purchase_price: z.number(), closing_date: z.string() }).partial();

  const results = await Promise.allSettled([
    timeIt("control (2 fields)", control),
    ...ASSET_CLASS_SECTIONS.multifamily.map((s) => timeIt(s.name, s.schema)),
  ]);

  return NextResponse.json(results.map((r) => (r.status === "fulfilled" ? r.value : { error: r.reason })));
}
