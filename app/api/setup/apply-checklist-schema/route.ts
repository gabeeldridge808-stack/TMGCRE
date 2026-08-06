// TEMPORARY — replaces the old (empty, unused) checklist_templates /
// deal_checklist_items tables with the new stage-keyed structure and seeds
// default items, then gets deleted. The old tables were never populated
// (see the removed schema.sql comment: "deliberately empty and unused"),
// so dropping them loses nothing.
import { NextResponse } from "next/server";
import { queryOrThrow } from "@/lib/db";

export async function GET() {
  try {
    await queryOrThrow(`drop table if exists deal_checklist_items;`);
    await queryOrThrow(`drop table if exists checklist_templates;`);

    await queryOrThrow(`
      create table checklist_templates (
        id uuid primary key default gen_random_uuid(),
        stage text not null check (stage in ('sourcing', 'underwriting', 'diligence', 'closing', 'closed', 'dead')),
        label text not null,
        sort_order int not null default 0
      );
    `);
    await queryOrThrow(`
      create table deal_checklist_items (
        id uuid primary key default gen_random_uuid(),
        deal_id uuid not null references deals(id) on delete cascade,
        stage text not null,
        label text not null,
        done boolean not null default false,
        sort_order int not null default 0,
        created_at timestamptz not null default now()
      );
    `);
    await queryOrThrow(`create index deal_checklist_items_deal_id_idx on deal_checklist_items (deal_id);`);

    await queryOrThrow(`
      insert into checklist_templates (stage, label, sort_order) values
        ('sourcing', 'Screen against investment criteria', 1),
        ('sourcing', 'OM / broker package received', 2),
        ('sourcing', 'Preliminary underwriting pass', 3),
        ('underwriting', 'Full pro forma built', 1),
        ('underwriting', 'Comps pulled', 2),
        ('underwriting', 'Site visit scheduled', 3),
        ('underwriting', 'LOI drafted', 4),
        ('diligence', 'PSA executed', 1),
        ('diligence', 'Earnest money deposited', 2),
        ('diligence', 'Phase 1 ESA ordered', 3),
        ('diligence', 'Title report ordered', 4),
        ('diligence', 'Survey ordered', 5),
        ('diligence', 'Rent roll / lease audit', 6),
        ('diligence', 'Lender engaged / term sheet', 7),
        ('closing', 'Loan committee approval', 1),
        ('closing', 'Title cleared', 2),
        ('closing', 'Insurance bound', 3),
        ('closing', 'Closing docs drafted', 4),
        ('closing', 'Wire instructions confirmed', 5),
        ('closed', 'Post-closing file archived', 1),
        ('closed', 'Property management transition', 2),
        ('closed', 'Investor reporting set up', 3);
    `);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
