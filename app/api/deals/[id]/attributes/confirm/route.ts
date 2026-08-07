import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { recordAuditLog } from "@/lib/auditLog";

// Writes a single attribute the chat agent proposed and a user explicitly
// accepted (see lib/agent.ts's PROPOSE_ATTRIBUTE_UPDATE_TOOL and the
// [[PROPOSAL:...]] marker handling in the chat route). This is the only
// path through which the chat agent's suggestions ever reach the database
// — there is no route that writes an attribute straight from the model's
// output without a human clicking to confirm it here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const reasoning = typeof body.reasoning === "string" ? body.reasoning : "";
  if (!key || !("value" in body)) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const [deal] = await query<{ id: string }>(`select id from deals where id = $1`, [id]);
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await query(
    `insert into deal_attributes (deal_id, key, value, source)
     values ($1, $2, $3, 'chat agent')
     on conflict (deal_id, key) do update set value = excluded.value, source = 'chat agent', updated_at = now()`,
    [id, key, JSON.stringify(body.value)]
  );

  await recordAuditLog(currentUser, {
    dealId: id,
    action: "attribute.confirmed_via_chat",
    details: { key, value: body.value, reasoning },
  });

  return NextResponse.json({ ok: true });
}
