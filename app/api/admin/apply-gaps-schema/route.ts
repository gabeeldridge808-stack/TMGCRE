// TEMPORARY — applies this batch's schema additions to production, then
// gets deleted. Local DATABASE_URL is a redacted placeholder (not a real
// connection), so schema changes get applied through a route running on
// the deployed app. Admin-auth required, unlike the old bootstrap-only
// /api/setup/* routes (removed once the real admin account existed).
import { NextResponse } from "next/server";
import { queryOrThrow } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can run this." }, { status: 403 });
  }

  try {
    await queryOrThrow(`alter table deal_attributes add column if not exists source text;`);
    await queryOrThrow(`alter table deals add column if not exists drive_folder_id text;`);
    await queryOrThrow(`
      create table if not exists chat_messages (
        id uuid primary key default gen_random_uuid(),
        deal_id uuid not null references deals(id) on delete cascade,
        role text not null check (role in ('user', 'assistant')),
        content text not null,
        created_at timestamptz not null default now()
      );
    `);
    await queryOrThrow(`create index if not exists chat_messages_deal_id_idx on chat_messages (deal_id);`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
