-- Deal-tracking platform schema.
--
-- Design principle: `deals` is a thin spine shared by every asset class.
-- Type-specific fields (multifamily unit mix, hospitality RevPAR, land
-- entitlement status, etc.) do NOT get forced into shared columns — they
-- live in `deal_attributes` as jsonb, keyed by attribute name. This avoids
-- a wide `deals` table full of nullable columns that only apply to one
-- asset class.

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";     -- pgvector

-- Auth. Credentials-based (bcrypt hash), JWT session cookie signed with
-- AUTH_SECRET — see lib/auth.ts. No separate sessions table: a JWT carries
-- (user id, email, role) and is verified statelessly in middleware, so
-- logging in doesn't require a DB round trip on every request.
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null default 'analyst' check (role in ('admin', 'analyst')),
  created_at timestamptz not null default now()
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_class text not null check (asset_class in ('multifamily', 'hospitality', 'land', 'office', 'retail', 'industrial', 'condo')),
  stage text not null default 'sourcing' check (stage in ('sourcing', 'underwriting', 'diligence', 'closing', 'closed', 'dead')),
  -- A real FK, not a free-text name — lets access control (lib/dealAccess.ts)
  -- check "is this user this deal's owner" without string matching, and
  -- means a deal never points at someone who doesn't have an account.
  owner_id uuid not null references users(id),
  -- Set by scripts/ingest.ts the first time a Drive folder is linked
  -- (via --deal-id + --drive-folder-id), so a later `--all` run knows
  -- which deals to re-sync without having to pass every folder id again.
  drive_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_asset_class_idx on deals (asset_class);
create index deals_stage_idx on deals (stage);
create index deals_owner_id_idx on deals (owner_id);

-- Ground-up / major-redevelopment deals. deal_category is orthogonal to
-- asset_class (an industrial deal can be an acquisition OR a development;
-- condo today is always development, but the column still applies to it
-- so cross-deal development queries don't special-case condo).
alter table deals add column deal_category text not null default 'acquisition'
  check (deal_category in ('acquisition', 'development'));

-- Separate from `stage` (sourcing/underwriting/diligence/closing/closed/
-- dead), which every deal keeps regardless of category and which drives
-- the Kanban board + checklist_templates. development_stage is the
-- ground-up-specific phase, additive rather than a replacement.
alter table deals add column development_stage text
  check (development_stage in (
    'site_control_diligence', 'entitlement', 'design_permitting',
    'construction', 'lease_up_sellout_stabilization'
  ));

-- A development deal must have a development_stage; an acquisition deal
-- must not -- catches the two ways this pair of columns could silently
-- drift out of sync (a dev deal with no stage, or a stage stuck on a
-- deal that got reclassified back to acquisition).
alter table deals add constraint development_stage_matches_category check (
  (deal_category = 'development' and development_stage is not null) or
  (deal_category = 'acquisition' and development_stage is null)
);

create index deals_deal_category_idx on deals (deal_category);
create index deals_development_stage_idx on deals (development_stage);

-- Audit trail: who changed what, when. Append-only — a row here is never
-- updated or deleted, so it stays a reliable record even after the deal
-- itself changes again or is deleted (deal_id references ... on delete set
-- null, not cascade, specifically so the log entry for a deletion survives
-- the deletion it's recording). user_name is denormalized so the log still
-- reads correctly if a user account is later removed.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  user_name text not null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_deal_id_idx on audit_log (deal_id);

-- "Ask the deal" chat history. Previously lived only in the browser tab's
-- React state — a refresh lost the conversation. One row per turn (both
-- the user's question and the assistant's full answer), replayed in order
-- to reseed the chat UI on page load and to give the agent proposal flow
-- (lib/agent.ts) something to reference across turns server-side too.
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_deal_id_idx on chat_messages (deal_id);

-- Type-specific fields, one row per (deal, attribute). jsonb `value` lets
-- each asset class define its own attribute set without a schema migration.
create table deal_attributes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  key text not null,
  value jsonb not null,
  -- Where this value came from: a source filename for an extracted
  -- attribute, 'manual' for one typed into the Edit form / API, 'chat
  -- agent' for one confirmed through a chat proposal, or null for rows
  -- written before this column existed. Purely provenance, never used to
  -- gate behavior.
  source text,
  -- True for anything a human entered or confirmed (manual edit, chat-
  -- agent proposal accepted) -- see lib/extractAttributes.ts's
  -- writeNewAttributes. A later document extraction finding the same key
  -- again may refresh an unlocked (extracted) value but must never
  -- silently overwrite a locked one; the human-facing edit/confirm paths
  -- can still always overwrite, locked or not.
  locked boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (deal_id, key)
);

create index deal_attributes_deal_id_idx on deal_attributes (deal_id);

-- Development module. Applies only to deals.deal_category = 'development'.
--
-- deal_development_details holds the deal's TRACKED, actual-vs-budget
-- status as it executes -- distinct from any asset class's underwriting
-- ASSUMPTIONS, which stay in deal_attributes as before (e.g. condo's
-- hard_costs/contingency_pct/loan_to_cost_pct already there feed
-- lib/condoUnderwritingModel.ts and are not duplicated here). The two
-- will often start equal at underwriting and diverge as the deal
-- proceeds -- that divergence is exactly what total_cost_actual is for.
create table deal_development_details (
  deal_id uuid primary key references deals(id) on delete cascade,

  site_control_structure text check (site_control_structure in ('owned', 'option', 'jv', 'ground_lease')),
  entitlement_jurisdiction text,
  -- Free text, not an enum -- real entitlement processes vary too much
  -- per jurisdiction to force into a fixed list. Dated approval steps
  -- live in deal_milestones below.
  entitlement_status text,

  -- Capital stack summary
  equity_amount numeric,
  senior_debt_amount numeric,
  mezz_pref_amount numeric,
  jv_structure text,              -- free text: promote structures vary too much for a rigid schema

  -- Key dates
  acquisition_closing_date date,
  permit_submittal_date date,
  gc_mobilization_date date,
  projected_delivery_date date,
  projected_stabilization_date date,

  -- Budget: a single running actual-vs-basis total, not a line-item ledger
  land_basis numeric,
  hard_costs_budget numeric,
  soft_costs_budget numeric,
  contingency_budget numeric,
  total_cost_basis numeric,
  total_cost_actual numeric,

  -- Risk flags
  entitlement_risk text check (entitlement_risk in ('low', 'medium', 'high')),
  cost_overrun_risk text check (cost_overrun_risk in ('low', 'medium', 'high')),
  market_risk text check (market_risk in ('low', 'medium', 'high')),

  updated_at timestamptz not null default now()
);

-- Open-ended dated events for a development deal: entitlement approval
-- steps (jurisdiction-specific, unpredictable in number -- a planning
-- commission hearing, a coastal commission sign-off, a city council
-- vote) AND budget/schedule-change flags surfaced from ingested documents
-- (a cost report or revised GC schedule creates a row here rather than a
-- boolean with nowhere to go -- see lib/documents.ts). One table, since
-- both are "named event + date + status" shaped and both feed the
-- cross-deal timeline view.
create table deal_milestones (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  category text not null check (category in ('entitlement_approval', 'budget_change', 'schedule_change', 'other')),
  label text not null,
  milestone_date date,            -- when it actually happened
  target_date date,               -- planned date, for ones still pending
  status text not null default 'pending' check (status in ('pending', 'complete', 'delayed', 'at_risk')),
  source_document text,           -- filename, same provenance idea as deal_attributes.source
  notes text,
  created_at timestamptz not null default now()
);

create index deal_milestones_deal_id_idx on deal_milestones (deal_id);

-- Per-asset-class development detail. One table per class rather than one
-- wide table, since the fields genuinely don't overlap (dock doors vs.
-- room count vs. HOA structure) -- this is the "fully relational" half of
-- the module; land uses only the shared tables above (its existing
-- deal_attributes land_scalars/land_planning sections already cover
-- entitlement_status/planned_use/far/acreage, so a land_development_details
-- table would just be empty).

create table industrial_development_details (
  deal_id uuid primary key references deals(id) on delete cascade,
  building_sf numeric,
  clear_height_ft numeric,
  dock_doors int,
  trailer_stalls int,
  office_sf numeric,
  truck_court_depth_ft numeric,
  delivery_type text check (delivery_type in ('spec', 'build_to_suit')),
  bts_tenant_name text,
  bts_tenant_lease_status text,
  bts_lease_term_months int,
  target_tenant_profile text,
  leasing_broker text,
  ios_yard_acreage numeric,
  ios_yard_stall_count int,
  ios_yard_projected_income numeric
);

create table hospitality_development_details (
  deal_id uuid primary key references deals(id) on delete cascade,
  room_count int,
  brand text,
  is_independent boolean not null default false,
  management_company text,
  franchise_agreement_status text,
  franchise_agreement_term_years int,
  fb_amenity_program text,
  projected_adr numeric,
  projected_occupancy_pct numeric,
  projected_revpar numeric,
  pip_cost numeric,
  is_conversion boolean not null default false
);

create table condo_development_details (
  deal_id uuid primary key references deals(id) on delete cascade,
  hoa_structure text,
  deposit_escrow_terms text,
  construction_lender_presale_threshold_pct numeric
);

-- Sales-pace TRACKING over time -- distinct from the static
-- absorption_rate_units_per_month assumption already in deal_attributes
-- (condoSales, lib/attributeSchemas.ts). One row per as-of snapshot.
create table condo_unit_sales (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  as_of_date date not null,
  units_released int not null,
  units_under_contract int not null,
  units_closed int not null,
  created_at timestamptz not null default now()
);

create index condo_unit_sales_deal_id_idx on condo_unit_sales (deal_id);

-- Reasoned by analogy from industrial's spec/BTS structure and a real pad
-- site plan (a QSR + drive-thru coffee pad development), not from an
-- explicit field list -- least-confirmed table in this module.
create table retail_development_details (
  deal_id uuid primary key references deals(id) on delete cascade,
  building_sf numeric,
  pad_count int,
  tenant_name text,
  tenant_status text check (tenant_status in ('vacant_spec', 'loi', 'lease_executed')),
  lease_term_months int,
  drive_thru boolean not null default false,
  parking_stalls_required int,
  parking_stalls_provided int
);

-- Document chunks for RAG. One row = one embeddable chunk of one source
-- file. A single source file (e.g. a 40-page OM) produces many rows here,
-- linked by (deal_id, drive_file_id) and ordered by chunk_index.
--
-- embedding is vector(1024), NOT vector(1536): 1536 is OpenAI's dimension.
-- Anthropic has no embeddings API; this project uses Voyage AI
-- (voyage-3-large, output_dimension pinned to 1024 in lib/embeddings.ts).
-- If you switch embedding providers/models later, this column's dimension
-- must match the new model's output exactly, and existing rows must be
-- re-embedded — pgvector will reject writes of the wrong dimension.
create table documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,

  -- source file identity, for incremental re-sync and dedup on re-ingestion
  drive_file_id text not null,
  drive_modified_time timestamptz not null,
  source_filename text not null,
  mime_type text not null,

  -- chunk identity within the source file
  chunk_index int not null,
  chunk_count int not null,
  page_number int,              -- best-effort, PDF only; null otherwise

  content text not null,
  content_hash text not null,   -- sha256 of `content`, cheap change-detection
  embedding vector(1024) not null,

  -- Development-module tagging (null for an acquisition deal's documents).
  -- document_type lets retrieval filter by deal + stage + document type, as
  -- section 3 of the development module asks for; development_stage tags
  -- which phase the document belongs to, independent of whatever stage the
  -- deal is in by the time someone searches for it.
  document_type text check (document_type in (
    'entitlement', 'gc_contract', 'franchise_agreement', 'psa',
    'cost_report', 'lease', 'financing_memo', 'other'
  )),
  development_stage text check (development_stage in (
    'site_control_diligence', 'entitlement', 'design_permitting',
    'construction', 'lease_up_sellout_stabilization'
  )),

  ingested_at timestamptz not null default now(),

  unique (deal_id, drive_file_id, chunk_index)
);

create index documents_deal_id_idx on documents (deal_id);
create index documents_drive_file_id_idx on documents (deal_id, drive_file_id);
create index documents_document_type_idx on documents (document_type);

-- ivfflat is fine at low row counts (hundreds-to-low-thousands of chunks).
-- Once a deal's corpus grows past that, or query latency becomes visible,
-- switch to hnsw (better recall, no need to retrain lists as data grows):
--   drop index documents_embedding_idx;
--   create index documents_embedding_idx on documents
--     using hnsw (embedding vector_cosine_ops);
create index documents_embedding_idx on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Sales comps, imported from a CSV export (e.g. a CoStar comps search
-- exported to CSV from the browser — see lib/compsImport.ts for why this
-- is a file import, not an automated scrape of CoStar's site). Comps are
-- deal-scoped, not a shared market-wide table: a comp is imported while
-- working a specific deal, same lifecycle as that deal's documents.
-- Columns cover what a comp export commonly has; `extra` keeps whatever
-- imported columns don't map to a known field, so nothing is silently
-- dropped.
create table comps (
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

create index comps_deal_id_idx on comps (deal_id);

-- Stage-transition checklists. checklist_templates is seed data (one row
-- per default item per stage, asset-class-agnostic for now); when a deal
-- enters a stage for the first time, lib/checklist.ts copies that stage's
-- template rows into deal_checklist_items for that specific deal. Copying
-- rather than referencing a template means checking an item off — or a
-- template changing later — never rewrites another deal's history.
create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('sourcing', 'underwriting', 'diligence', 'closing', 'closed', 'dead')),
  label text not null,
  sort_order int not null default 0
);

create table deal_checklist_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  stage text not null,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index deal_checklist_items_deal_id_idx on deal_checklist_items (deal_id);

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

create index deal_checklist_items_deal_id_idx on deal_checklist_items (deal_id);
