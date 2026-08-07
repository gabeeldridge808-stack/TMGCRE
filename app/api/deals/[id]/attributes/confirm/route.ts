import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireDealAccess } from "@/lib/dealAccess";
import { recordAuditLog } from "@/lib/auditLog";

// Writes a single attribute the chat agent proposed and a user explicitly
// accepted (see lib/agent.ts's PROPOSE_ATTRIBUTE_UPDATE_TOOL and the
// [[PROPOSAL:...]] marker handling in the chat route). This is the only
// path through which the chat agent's suggestions ever reach the database
// — there is no route that writes an attribute straight from the model's
// output without a human clicking to confirm it here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;
  const currentUser = access.user;

  const body = await req.json();
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const reasoning = typeof body.reasoning === "string" ? body.reasoning : "";
  if (!key || !("value" in body)) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  await query(
    `insert into deal_attributes (deal_id, key, value, source, locked)
     values ($1, $2, $3, 'chat agent', true)
     on conflict (deal_id, key) do update set value = excluded.value, source = 'chat agent', locked = true, updated_at = now()`,
    [id, key, JSON.stringify(body.value)]
  );

  await recordAuditLog(currentUser, {
    dealId: id,
    action: "attribute.confirmed_via_chat",
    details: { key, value: body.value, reasoning },
  });

  return NextResponse.json({ ok: true });
}
