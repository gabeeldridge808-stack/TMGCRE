import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { streamIcMemo, type MemoComp } from "@/lib/icMemo";
import { DEFAULT_UNDERWRITING_INPUTS, deriveInputsFromAttributes, runUnderwritingModel } from "@/lib/underwritingModel";

// Same reasoning as the extraction route: Opus 5 at high effort drafting a
// multi-section memo can run well past a 60s ceiling.
export const maxDuration = 300;

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — memo generation is unavailable." },
      { status: 503 }
    );
  }

  const [deal] = await query<Deal>(`select id, name, asset_class, stage, owner from deals where id = $1`, [id]);
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const attributes = await query<{ key: string; value: unknown }>(
    `select key, value from deal_attributes where deal_id = $1`,
    [id]
  );

  const comps = await query<MemoComp>(
    `select property_name, sale_price, price_per_sqft, price_per_unit, cap_rate
     from comps where deal_id = $1 order by sale_date desc nulls last, created_at desc`,
    [id]
  );

  const underwriting = runUnderwritingModel({
    ...DEFAULT_UNDERWRITING_INPUTS,
    ...deriveInputsFromAttributes(attributes),
  });

  const stream = await streamIcMemo(
    { name: deal.name, assetClass: deal.asset_class, stage: deal.stage, owner: deal.owner, attributes },
    underwriting,
    comps
  );

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        controller.enqueue(encoder.encode(`\n\n[Memo generation hit an error: ${message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
