import { NextRequest, NextResponse } from "next/server";
import { query, queryOrThrow } from "@/lib/db";
import { describeDealWriteError } from "@/lib/deals";

interface Deal {
  id: string;
  name: string;
  asset_class: string;
  stage: string;
  owner: string;
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
  const body = await req.json();
  const { name, asset_class, stage, owner, attributes } = body;

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
         owner = coalesce($5, owner),
         updated_at = now()
       where id = $1
       returning *`,
      [id, name, asset_class, stage, owner]
    );
  } catch (error) {
    const { status, message } = describeDealWriteError(error);
    return NextResponse.json({ error: message }, { status });
  }

  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (attributes && typeof attributes === "object") {
    for (const [key, value] of Object.entries(attributes)) {
      await query(
        `insert into deal_attributes (deal_id, key, value)
         values ($1, $2, $3)
         on conflict (deal_id, key) do update set value = excluded.value, updated_at = now()`,
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
  const { id } = await params;
  const deleted = await query<{ id: string }>(
    `delete from deals where id = $1 returning id`,
    [id]
  );

  if (deleted.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
