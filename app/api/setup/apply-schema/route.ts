// TEMPORARY — applies the users + audit_log tables to production, then
// gets deleted. Local DATABASE_URL is a redacted placeholder (not a real
// connection), so schema changes get applied through a route running on
// the deployed app, which does have real DB access. Same pattern as the
// comps table's one-time apply route (already removed).
import { NextResponse } from "next/server";
import { queryOrThrow } from "@/lib/db";

export async function GET() {
  try {
    await queryOrThrow(`
      create table if not exists users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        password_hash text not null,
        name text not null,
        role text not null default 'analyst' check (role in ('admin', 'analyst')),
        created_at timestamptz not null default now()
      );
    `);
    await queryOrThrow(`
      create table if not exists audit_log (
        id uuid primary key default gen_random_uuid(),
        deal_id uuid references deals(id) on delete set null,
        user_id uuid references users(id) on delete set null,
        user_name text not null,
        action text not null,
        details jsonb not null default '{}',
        created_at timestamptz not null default now()
      );
    `);
    await queryOrThrow(`create index if not exists audit_log_deal_id_idx on audit_log (deal_id);`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
