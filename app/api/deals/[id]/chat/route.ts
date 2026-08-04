import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { streamDealAgentAnswer, type ChatMessage, type DealAttribute, type DealContext } from "@/lib/agent";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — the deal agent is unavailable." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const history: ChatMessage[] = Array.isArray(body.history) ? body.history : [];

  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const [deal] = await query<Deal>(
    `select id, name, asset_class, stage, owner from deals where id = $1`,
    [id]
  );
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const attributes = await query<DealAttribute>(
    `select key, value from deal_attributes where deal_id = $1`,
    [id]
  );

  const dealContext: DealContext = { ...deal, attributes };
  const stream = await streamDealAgentAnswer(dealContext, question, history);

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          } else if (
            event.type === "content_block_start" &&
            event.content_block.type === "server_tool_use" &&
            event.content_block.name === "web_search"
          ) {
            controller.enqueue(encoder.encode("\n[Searching the web…]\n"));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        controller.enqueue(encoder.encode(`\n\n[The agent hit an error: ${message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
