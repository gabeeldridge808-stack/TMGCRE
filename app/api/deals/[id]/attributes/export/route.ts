import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireDealAccess } from "@/lib/dealAccess";
import { toCsv } from "@/lib/csvExport";
import { FIELD_META } from "@/lib/attributeSchemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireDealAccess(id);
  if (!access.ok) return access.response;

  const [deal] = await query<{ name: string }>(`select name from deals where id = $1`, [id]);
  if (!deal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const attributes = await query<{ key: string; value: unknown; source: string | null }>(
    `select key, value, source from deal_attributes where deal_id = $1 order by key`,
    [id]
  );

  const csv = toCsv(
    attributes.map((a) => ({
      field: FIELD_META[a.key]?.label ?? a.key,
      key: a.key,
      value: typeof a.value === "object" ? JSON.stringify(a.value) : String(a.value),
      source: a.source ?? "",
    }))
  );

  const filename = `${deal.name.replace(/[^a-z0-9]+/gi, "-")}-attributes.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
