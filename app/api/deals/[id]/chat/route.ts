import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireDealAccess } from "@/lib/dealAccess";
import { streamDealAgentAnswer, type ChatMessage, type DealAttribute, type DealContext } from "@/lib/agent";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner_name: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — the deal agent is unavailable." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const [deal] = await query<Deal>(
    `select d.id, d.name, d.asset_class, d.stage, u.name as owner_name
     from deals d join users u on u.id = d.owner_id
     where d.id = $1`,
    [id]
  );
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const attributes = await query<DealAttribute>(
    `select key, value from deal_attributes where deal_id = $1`,
    [id]
  );

  // History now comes from the database, not the client — one shared
  // conversation per deal (like everything else in this app: attributes,
  // comps, the audit log), not a private thread per user, and it survives
  // a refresh or a different person picking up the same deal later.
  const priorMessages = await query<ChatMessage>(
    `select role, content from chat_messages where deal_id = $1 order by created_at asc`,
    [id]
  );

  await query(`insert into chat_messages (deal_id, role, content) values ($1, 'user', $2)`, [id, question]);

  const dealContext: DealContext = { ...deal, attributes };
  const stream = await streamDealAgentAnswer(dealContext, question, priorMessages);

  const encoder = new TextEncoder();
  let fullAnswer = "";
  // Custom tool_use content blocks (propose_attribute_update) stream their
  // input as incremental JSON fragments (input_json_delta), keyed by block
  // index — buffered here and only emitted once complete and parseable,
  // as a [[PROPOSAL:{...}]] marker the client regex-extracts into an
  // accept/reject card (see DealChat.tsx). Never emitted partial/broken JSON.
  const toolBlocks = new Map<number, { name: string; json: string }>();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullAnswer += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          } else if (
            event.type === "content_block_start" &&
            event.content_block.type === "server_tool_use" &&
            event.content_block.name === "web_search"
          ) {
            controller.enqueue(encoder.encode("\n[Searching the web…]\n"));
          } else if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
            toolBlocks.set(event.index, { name: event.content_block.name, json: "" });
          } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
            const block = toolBlocks.get(event.index);
            if (block) block.json += event.delta.partial_json;
          } else if (event.type === "content_block_stop") {
            const block = toolBlocks.get(event.index);
            if (block?.name === "propose_attribute_update") {
              try {
                const parsed = JSON.parse(block.json);
                if (typeof parsed.key === "string" && "value" in parsed && typeof parsed.reasoning === "string") {
                  const marker = `\n\n[[PROPOSAL:${JSON.stringify(parsed)}]]\n\n`;
                  fullAnswer += marker;
                  controller.enqueue(encoder.encode(marker));
                }
              } catch (err) {
                console.error("Failed to parse propose_attribute_update input:", block.json, err);
              }
              toolBlocks.delete(event.index);
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        const suffix = `\n\n[The agent hit an error: ${message}]`;
        fullAnswer += suffix;
        controller.enqueue(encoder.encode(suffix));
      } finally {
        controller.close();
        if (fullAnswer.trim()) {
          await query(`insert into chat_messages (deal_id, role, content) values ($1, 'assistant', $2)`, [
            id,
            fullAnswer,
          ]);
        }
      }
    },
  });

  return new Response(readable, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
