// TEMPORARY — applies the new `comps` table to production, then gets
// deleted. Local DATABASE_URL is a redacted placeholder (not a real
// connection), so schema changes get applied through a route running on
// the deployed app, which does have real DB access.
import { NextResponse } from "next/server";
import { queryOrThrow } from "@/lib/db";

export async function GET() {
  try {
    await queryOrThrow(`
      create table if not exists comps (
        id uuid primary key default gen_random_uuid(),
        deal_id uuid not null references deals(id) on delete cascade,
        property_name text,
        address text,
        city text,
        state text,
        asset_class text,
        sale_date date,
        sale_price numeric,
        price_per_sqft numeric,
        price_per_unit numeric,
        cap_rate numeric,
        building_sqft numeric,
        unit_count numeric,
        year_built numeric,
        buyer text,
        seller text,
        source text not null default 'CSV import',
        extra jsonb not null default '{}',
        created_at timestamptz not null default now()
      );
    `);
    await queryOrThrow(`create index if not exists comps_deal_id_idx on comps (deal_id);`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
