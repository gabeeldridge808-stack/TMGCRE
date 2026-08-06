# Deal Tracker

Internal deal-tracking platform for a real estate/PE team.

## Architecture decisions

**`deals` spine + `deal_attributes` jsonb, not a wide table.** Multifamily,
hospitality, and land deals each have their own set of underwriting fields
that don't overlap much (unit mix vs. RevPAR vs. entitlement status). Rather
than a `deals` table with dozens of nullable columns, shared fields
(name, asset_class, stage, owner) live on `deals`, and everything
type-specific lives in `deal_attributes` as `(deal_id, key, value jsonb)`
rows. Add a new asset class's fields without a migration.

**Checklists are deliberately unbuilt.** `checklist_templates` and
`deal_checklist_items` exist in the schema but nothing writes to them yet.
Templatizing a diligence checklist before you have 2-3 real deals of the
same asset class to generalize from means guessing at structure — better to
wait and build it from real examples.

**Embeddings use Voyage AI, not Anthropic.** Anthropic's API has no
embeddings endpoint. Voyage AI is Anthropic's recommended embeddings
partner. This project uses `voyage-3-large` with `output_dimension: 1024`
(see `lib/embeddings.ts`) — the `documents.embedding` column is
`vector(1024)` to match. If you later switch models/providers, the column
dimension and every existing row's embedding both need to change together.

**One `documents` row = one chunk, not one file.** A single OM or rent roll
produces many rows, linked by `(deal_id, drive_file_id)` and ordered by
`chunk_index`. See `schema.sql` for the full column rationale (dedup via
`content_hash`, incremental re-sync via `drive_modified_time`, source
traceability via `source_filename`/`page_number`).

**The deal-workspace chat agent is RAG plus web search, not a general
assistant.** Every question is answered from the deal's `deal_attributes`
rows, the top-K chunks retrieved from `documents` for that deal, and — for
anything the deal's own files can't have, like current cap rate trends or
comparable sales — Anthropic's server-side `web_search` tool (see
`lib/agent.ts`). The system prompt (`CRE_ANALYST_SYSTEM_PROMPT`) is written
to cite sources for both (source filename/page for deal facts, publication
for web results) and say "not in the file" rather than estimate — with real
money on the line, a confident hallucination is worse than no answer. It
still doesn't see other deals and can't write anything back mid-chat (no
client-side tools yet) — see attribute extraction below for the one place
the agent *does* write. Model is pinned to `claude-opus-5`; this is
judgment-heavy underwriting work, not worth downgrading for cost.

**Attribute extraction runs at ingest time, not chat time, and is
insert-only.** After `scripts/ingest.ts` (or a direct upload) writes a
document, it makes one Claude call (`lib/extractAttributes.ts`) over the
newly-extracted text and writes whatever comes back to `deal_attributes`
with `on conflict (deal_id, key) do nothing`. Two deliberate choices: it
runs at ingest (a batch job with the full document text on hand) rather
than being a tool the chat agent calls mid-conversation (where it would
need to decide *when* writing is appropriate, and RAG chunks are a worse
extraction source than full documents); and it never overwrites an
existing key, so re-ingesting a folder — or a human correcting a bad
extraction — can never be silently clobbered by a later run.

**Attribute schemas are per-asset-class and typed, but additive — not a
migration.** `lib/attributeSchemas.ts` defines what a CRE acquisitions team
actually tracks per asset class (multifamily: unit mix, T-12 NOI,
occupancy, avg in-place/market rent; office: rent roll, WAULT, lease type;
retail: anchor tenants, sales/SF, CAM recovery; industrial: clear height,
dock doors, lease escalations; hospitality: ADR, RevPAR, GOP margin, flag;
land: zoning, entitlement status, FAR — plus shared deal-economics fields
every asset class gets: cap rates, IRR, DSCR, LTV, etc.) as Zod schemas.
This is a typed layer *on top of* `deal_attributes`, not a schema change to
it — the table is still `(deal_id, key, value jsonb)`, so nothing about
existing rows or the DB schema changes. The Zod schema does two jobs: (1)
`lib/extractAttributes.ts` hands the deal's asset-class schema to Claude
via structured outputs (`client.messages.parse` + `zodOutputFormat`) so a
rent roll fills the `unit_mix` array with one row per unit type instead of
Claude inventing its own loosely-typed keys, and (2) `FIELD_META` (label +
group + unit per field) drives the grouped, labeled Attributes UI
(`AttributesSection.tsx`) instead of a raw key: value dump. A coverage
test (`lib/attributeSchemas.test.ts`) fails the build if a schema field is
ever added without a matching `FIELD_META` entry.

**The underwriting summary is computed at render time, not stored.**
`lib/underwriting.ts` derives a handful of sanity-check ratios (implied cap
rate vs. the OM's stated one, implied DSCR, cash-on-cash, price per
unit/SF/key) from whatever numeric attributes are already present, and
flags when a computed figure doesn't reconcile with a stated one (e.g. OM
claims 5.5% going-in cap rate, but NOI ÷ price implies 4.5%). Deliberately
not a full multi-year proforma/IRR model — that needs real cash-flow
projections, which is a separate, bigger feature (see the roadmap).

**Direct document upload goes through our own API route, capped at
4.5MB.** `app/deals/[id]/DealDocumentUpload.tsx` posts the file as
`FormData` to `app/api/deals/[id]/documents/route.ts`, which uploads it to
Vercel Blob server-side (`put()`) and immediately runs it through the same
extract → chunk → embed → write → extract-attributes pipeline as
`scripts/ingest.ts` (both now call the shared `lib/documents.ts`). This
was **not** the first design: the first attempt used Vercel Blob's
client-side token-exchange flow (`@vercel/blob/client`'s `upload()`,
uploading straight from the browser to bypass Vercel's 4.5MB serverless
body limit for large OMs). That flow hit a reproducible `Headers.append:
... is an invalid header value` failure inside `@vercel/blob` itself
(confirmed in both Node and a real headless-Chromium run against
production — not an environment artifact), with no clear root cause found
after fairly deep investigation (traced into the SDK's bundled source).
Rather than keep chasing an unexplained SDK bug, the route was simplified
to the server-side path — no token exchange, no cross-origin upload
complexity, much smaller surface area, at the cost of the 4.5MB ceiling.
Revisit the client-upload approach (or presigned URLs) if that ceiling
becomes a real problem. The Drive-file-identity columns (`drive_file_id`,
`drive_modified_time`) are reused for uploaded files too — an uploaded
file's Blob pathname stands in for a Drive file ID, since both are just
"how do I dedup/re-sync this specific source file" identities; see
schema.sql.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in:
   - `DATABASE_URL` — a hosted Postgres instance with the `vector` extension
     available (Supabase/Neon both support it; enable it if it isn't
     already).
   - `VOYAGE_API_KEY` — from [voyageai.com](https://www.voyageai.com/).
   - `GOOGLE_SERVICE_ACCOUNT_KEY` — create a service account in Google Cloud
     Console yourself, then share the target Drive folder(s) with the
     service account's `client_email`. Paste the full key JSON as one line.
   - `ANTHROPIC_API_KEY` — from the
     [Anthropic Console](https://console.anthropic.com/settings/keys). Powers
     the "Ask the deal" chat on each deal's workspace page.
   - `BLOB_READ_WRITE_TOKEN` — create a Blob store in the Vercel dashboard
     (Project > Storage > Create Database > Blob) and this is added to your
     project automatically; pull it locally with `vercel env pull`. Powers
     direct document upload on each deal's workspace page.
2. `npm install`
3. Run `schema.sql` against your database (e.g. `psql $DATABASE_URL -f schema.sql`).
4. `npm run dev` — portfolio index at `/`, deal workspace at `/deals/[id]`.

## Uploading documents

The deal workspace page (`/deals/[id]`) has a file picker — pick a PDF,
Word doc, or plain text file (up to 4.5MB) and it's uploaded, extracted,
chunked, embedded, indexed, and run through attribute extraction
automatically. This is the normal path for one-off documents. For anything
larger, use the Google Drive bulk path below — see the architecture note
above for why there's a size ceiling here at all.

## Bulk ingestion from Google Drive

```
npm run ingest -- --deal-id <uuid> --drive-folder-id <folder-id> --dry-run
```

Dry-run walks the Drive folder (recursively — deal rooms are usually
organized into subfolders), extracts and chunks every file, and reports
what it found — without calling the embeddings API or touching the
database. Run this first against a real deal's real documents to see what
breaks (scanned PDFs with no text layer, Google Sheets, password-protected
files, etc.) before spending API calls.

Drop `--dry-run` to actually embed and write to `documents`. Safe to
re-run: matching `content_hash` skips the write, and stale chunks (from a
file that got shorter) are cleaned up.

Once documents are written, ingest also runs one attribute-extraction pass
over everything it just processed and writes any structured fields it finds
(purchase price, unit mix, cap rate, whatever's explicit in the text) to
`deal_attributes` — see the architecture note above. This step is skipped
on `--dry-run`, same as embeddings.

## Verifying retrieval

```
npm run search -- --deal-id <uuid> --query "what's the cap rate assumption?"
```

Embeds the query, does a cosine similarity search against that deal's
chunks, and prints the top matches with a similarity score and source file.
No chat/agent layer — this is purely "does the right chunk come back for a
question I know the answer to." The chat/agent layer itself is the "Ask the
deal" box on `/deals/[id]` (see `lib/agent.ts` and the architecture note
above) — same retrieval, plus Claude to read and reason over what comes back.

## End-to-end tests

```
npm run test:e2e
```

Playwright, against a real deployed URL — not a local dev server, since
this environment's `DATABASE_URL` is a placeholder with no real backend to
run one against (`playwright.config.ts` defaults to production; override
with `E2E_BASE_URL` to point at a preview deployment instead). Requires an
existing account:

```
E2E_TEST_EMAIL=you@example.com E2E_TEST_PASSWORD=yourpassword npm run test:e2e
```

Tests that don't need to be logged in (`e2e/auth.spec.ts`'s redirect/invalid-
login/401 checks) run without these and are skipped only where they
specifically require a working login. Deal-deletion assertions require that
account to have the `admin` role. Tests clean up the deals they create
(by name, in `beforeEach`/`afterEach`) so repeated runs don't accumulate
data in whatever portfolio they're pointed at.

## Deploying to Vercel

The app builds cleanly for production (`npm run build`) and needs no
`vercel.json` — Vercel auto-detects Next.js. What's left is entirely
account/config work on your side; none of it can be done from this repo:

1. **Push this repo to GitHub** (or GitLab/Bitbucket) and import it in
   Vercel ("Add New... > Project"), or skip Git entirely and run
   `vercel` from this directory with the [Vercel CLI](https://vercel.com/docs/cli).
2. **Provision Postgres with the `vector` extension** — Supabase or Neon
   both work (see Setup below); Vercel Postgres does not support pgvector
   as of this writing. Run `schema.sql` against it once created.
3. **Set environment variables** in the Vercel project settings (Project
   > Settings > Environment Variables) — the same four from
   `.env.local.example`:
   - `DATABASE_URL` (required for the app to do anything at all)
   - `ANTHROPIC_API_KEY` (required for the "Ask the deal" chat and for
     attribute extraction on upload)
   - `BLOB_READ_WRITE_TOKEN` (required for the in-app document upload
     button — auto-added once you create a Blob store, see Setup below)
   - `VOYAGE_API_KEY` (required for document upload/ingestion — embeddings)
   - `GOOGLE_SERVICE_ACCOUNT_KEY` (only needed for `npm run ingest`, the
     Drive-based bulk path — not the in-app upload button)
4. **Redeploy** after setting env vars — Vercel doesn't hot-reload them
   into a running deployment.

**What happens if you deploy without `DATABASE_URL` set correctly:** the
portfolio page (`/`) and deal workspace (`/deals/[id]`) degrade quietly —
`lib/db.ts` catches connection failures and returns empty results rather
than crashing the page (by design, see that file), so you'll see "no
deals" instead of an error. The one place this was surfaced properly is
the "New Deal" form, which now shows a clear inline error on failure
(that was the bug fixed earlier in this project's history) — that's the
fastest way to confirm the database is actually reachable after you
deploy.

`scripts/ingest.ts` and `scripts/search.ts` are CLI tools, not part of
the deployed app — run them from your own machine (or CI) pointed at the
same `DATABASE_URL` as production.

## Known gaps

- **No OCR.** Scanned/image-only PDFs extract zero text and are skipped
  with a warning during ingestion, not silently dropped.
- **PDF page numbers only.** `documents.page_number` is populated for PDFs;
  docx and Google Docs have no reliable page concept at extraction time, so
  it's `null` for those.
- **One deal at a time.** `scripts/ingest.ts` takes a single `--deal-id` /
  `--drive-folder-id` pair by design — generalizing to a loop over all
  deals is a deliberate next step, not done yet.
- **The chat agent has no memory across sessions and can't write.** Message
  history lives in the browser tab, not the database, so a refresh loses the
  conversation. It also can't write to `deal_attributes` or
  `deal_checklist_items` mid-chat, or pull from a dedicated comps/data API —
  only the batch extraction step at ingest time writes anything.
- **Attribute extraction has no confidence/provenance trail.** A written
  attribute records which document it came from in the console log at
  ingest time, but that source isn't persisted alongside the value in
  `deal_attributes` — the table only has `(key, value)`, same as
  human-entered attributes. If mis-extractions turn out to be a real
  problem, that's the first schema change to make.
