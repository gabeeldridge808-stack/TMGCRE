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
  asset_class text not null check (asset_class in ('multifamily', 'hospitality', 'land', 'office', 'retail', 'industrial')),
  stage text not null default 'sourcing' check (stage in ('sourcing', 'underwriting', 'diligence', 'closing', 'closed', 'dead')),
  owner text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_asset_class_idx on deals (asset_class);
create index deals_stage_idx on deals (stage);

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

-- Type-specific fields, one row per (deal, attribute). jsonb `value` lets
-- each asset class define its own attribute set without a schema migration.
create table deal_attributes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (deal_id, key)
);

create index deal_attributes_deal_id_idx on deal_attributes (deal_id);

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

  ingested_at timestamptz not null default now(),

  unique (deal_id, drive_file_id, chunk_index)
);

create index documents_deal_id_idx on documents (deal_id);
create index documents_drive_file_id_idx on documents (deal_id, drive_file_id);

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

-- Checklist tables: deliberately empty and unused. Not building checklist
-- logic until 2-3 real deals of the same asset class exist to templatize
-- from — see README.md.
create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  asset_class text not null,
  name text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table deal_checklist_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  template_id uuid references checklist_templates(id),
  label text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index deal_checklist_items_deal_id_idx on deal_checklist_items (deal_id);
