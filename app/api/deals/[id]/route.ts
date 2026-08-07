import { NextRequest, NextResponse } from "next/server";
import { query, queryOrThrow } from "@/lib/db";
import { describeDealWriteError } from "@/lib/deals";
import { requireDealAccess } from "@/lib/dealAccess";
import { getCurrentUser } from "@/lib/session";
import { recordAuditLog } from "@/lib/auditLog";
import { ensureChecklistForStage } from "@/lib/checklist";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface DealAttribute {
  key: string;
  value: unknown;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const [deal] = await query<Deal>(`select * from deals where id = $1`, [id]);
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const attributes = await query<DealAttribute>(
    `select key, value from deal_attributes where deal_id = $1`,
    [id]
  );

  return NextResponse.json({ ...deal, attributes });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const body = await req.json();
  const { name, asset_class, stage, owner_id, attributes } = body;

  // Only an admin can reassign ownership through this route — anyone else's
  // owner_id is silently ignored rather than trusted from the request body.
  const effectiveOwnerId = access.user.role === "admin" ? owner_id : undefined;

  let deal: Deal | undefined;
  try {
    // queryOrThrow, not query — a bad asset_class/stage here must surface as
    // the actual check-constraint error, not silently look like "not found"
    // (query() swallows DB errors into an empty result set; see lib/db.ts).
    [deal] = await queryOrThrow<Deal>(
      `update deals set
         name = coalesce($2, name),
         asset_class = coalesce($3, asset_class),
         stage = coalesce($4, stage),
         owner_id = coalesce($5, owner_id),
         updated_at = now()
       where id = $1
       returning *`,
      [id, name, asset_class, stage, effectiveOwnerId]
    );
  } catch (error) {
    const { status, message } = describeDealWriteError(error);
    return NextResponse.json({ error: message }, { status });
  }

  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await recordAuditLog(access.user, { dealId: id, action: "deal.updated" });

  await ensureChecklistForStage(deal.id, deal.stage);

  if (attributes && typeof attributes === "object") {
    for (const [key, value] of Object.entries(attributes)) {
      await query(
        `insert into deal_attributes (deal_id, key, value, source, locked)
         values ($1, $2, $3, 'manual', true)
         on conflict (deal_id, key) do update set value = excluded.value, source = 'manual', locked = true, updated_at = now()`,
        [id, key, JSON.stringify(value)]
      );
    }
  }

  return NextResponse.json(deal);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete deals." }, { status: 403 });
  }

  const { id } = await params;
  const [deal] = await query<{ id: string; name: string }>(`select id, name from deals where id = $1`, [id]);
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Logged before the delete, not after: audit_log.deal_id references
  // deals(id) — once the deal row is gone, an insert naming it as deal_id
  // would fail its own foreign key. The deal name goes into `details` so
  // the entry stays meaningful once ON DELETE SET NULL nulls deal_id out.
  await recordAuditLog(currentUser, { dealId: id, action: "deal.deleted", details: { name: deal.name } });

  const deleted = await query<{ id: string }>(
    `delete from deals where id = $1 returning id`,
    [id]
  );

  if (deleted.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
