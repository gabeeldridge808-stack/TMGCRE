import { NextRequest, NextResponse } from "next/server";
import { query, queryOrThrow } from "@/lib/db";

interface Comp {
  id: string;
  deal_id: string;
  property_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  asset_class: string | null;
  sale_date: string | null;
  sale_price: string | null;
  price_per_sqft: string | null;
  price_per_unit: string | null;
  cap_rate: string | null;
  building_sqft: string | null;
  unit_count: string | null;
  year_built: string | null;
  buyer: string | null;
  seller: string | null;
  source: string;
  extra: Record<string, string>;
  created_at: string;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comps = await query<Comp>(
    `select * from comps where deal_id = $1 order by sale_date desc nulls last, created_at desc`,
    [id]
  );
  return NextResponse.json(comps);
}

const TEXT_FIELDS = ["property_name", "address", "city", "state", "asset_class", "buyer", "seller"] as const;
const NUMERIC_FIELDS = [
  "sale_price",
  "price_per_sqft",
  "price_per_unit",
  "cap_rate",
  "building_sqft",
  "unit_count",
  "year_built",
] as const;

// Imported comp count per request is bounded by what a person exports from
// a comps search in one go — this is not a bulk-load pipeline, so a plain
// per-row insert loop (not a single multi-row statement) keeps the
// parameterization simple and each row's failure isolated.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: dealId } = await params;

  const [deal] = await query<{ id: string }>(`select id from deals where id = $1`, [dealId]);
  if (!deal) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  const body = await req.json();
  const comps = body.comps;
  if (!Array.isArray(comps) || comps.length === 0) {
    return NextResponse.json({ error: "comps must be a non-empty array" }, { status: 400 });
  }

  let inserted = 0;
  try {
    for (const raw of comps) {
      if (typeof raw !== "object" || raw === null) continue;
      const record = raw as Record<string, unknown>;

      const values: Record<string, unknown> = {};
      for (const f of TEXT_FIELDS) {
        if (typeof record[f] === "string" && record[f]) values[f] = record[f];
      }
      for (const f of NUMERIC_FIELDS) {
        if (typeof record[f] === "number" && Number.isFinite(record[f])) values[f] = record[f];
      }
      if (typeof record.sale_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.sale_date)) {
        values.sale_date = record.sale_date;
      }
      const extra = typeof record.extra === "object" && record.extra !== null ? record.extra : {};

      await queryOrThrow(
        `insert into comps (
           deal_id, property_name, address, city, state, asset_class,
           sale_date, sale_price, price_per_sqft, price_per_unit, cap_rate,
           building_sqft, unit_count, year_built, buyer, seller, extra
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          dealId,
          values.property_name ?? null,
          values.address ?? null,
          values.city ?? null,
          values.state ?? null,
          values.asset_class ?? null,
          values.sale_date ?? null,
          values.sale_price ?? null,
          values.price_per_sqft ?? null,
          values.price_per_unit ?? null,
          values.cap_rate ?? null,
          values.building_sqft ?? null,
          values.unit_count ?? null,
          values.year_built ?? null,
          values.buyer ?? null,
          values.seller ?? null,
          JSON.stringify(extra),
        ]
      );
      inserted++;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import comps.", inserted },
      { status: 500 }
    );
  }

  return NextResponse.json({ inserted }, { status: 201 });
}
