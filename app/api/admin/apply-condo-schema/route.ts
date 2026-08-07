// TEMPORARY — adds 'condo' to the deals.asset_class check constraint in
// production, then gets deleted. Local DATABASE_URL is a redacted
// placeholder (not a real connection), so schema changes get applied
// through a route running on the deployed app, which does have real DB
// access. Same pattern as this project's other one-time schema-apply
// routes (already removed after use). Under /api/admin, not /api/setup,
// since it requires an authenticated admin (middleware protects
// everything except /login and /api/setup — this route deliberately does
// NOT bypass that, unlike the old bootstrap-only setup routes).
import { NextResponse } from "next/server";
import { queryOrThrow } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can run this." }, { status: 403 });
  }

  try {
    await queryOrThrow(`alter table deals drop constraint if exists deals_asset_class_check;`);
    await queryOrThrow(`
      alter table deals add constraint deals_asset_class_check
        check (asset_class in ('multifamily', 'hospitality', 'land', 'office', 'retail', 'industrial', 'condo'));
    `);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
