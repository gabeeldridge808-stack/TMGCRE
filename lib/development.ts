// Data layer for the development module (schema.sql's "Development module"
// section) -- deal_development_details, deal_milestones, the per-asset-class
// development detail tables, and condo_unit_sales. Kept separate from
// lib/deals.ts (the acquisition-flow spine) since these only ever apply to
// deal_category = 'development'.
import { query, queryOrThrow } from "@/lib/db";
import type { AssetClass, DevelopmentStage } from "@/lib/dealConstants";

export interface DevelopmentDetails {
  deal_id: string;
  site_control_structure: "owned" | "option" | "jv" | "ground_lease" | null;
  entitlement_jurisdiction: string | null;
  entitlement_status: string | null;
  equity_amount: number | null;
  senior_debt_amount: number | null;
  mezz_pref_amount: number | null;
  jv_structure: string | null;
  acquisition_closing_date: string | null;
  permit_submittal_date: string | null;
  gc_mobilization_date: string | null;
  projected_delivery_date: string | null;
  projected_stabilization_date: string | null;
  land_basis: number | null;
  hard_costs_budget: number | null;
  soft_costs_budget: number | null;
  contingency_budget: number | null;
  total_cost_basis: number | null;
  total_cost_actual: number | null;
  entitlement_risk: "low" | "medium" | "high" | null;
  cost_overrun_risk: "low" | "medium" | "high" | null;
  market_risk: "low" | "medium" | "high" | null;
  updated_at: string;
}

const DEVELOPMENT_DETAIL_COLUMNS = [
  "site_control_structure",
  "entitlement_jurisdiction",
  "entitlement_status",
  "equity_amount",
  "senior_debt_amount",
  "mezz_pref_amount",
  "jv_structure",
  "acquisition_closing_date",
  "permit_submittal_date",
  "gc_mobilization_date",
  "projected_delivery_date",
  "projected_stabilization_date",
  "land_basis",
  "hard_costs_budget",
  "soft_costs_budget",
  "contingency_budget",
  "total_cost_basis",
  "total_cost_actual",
  "entitlement_risk",
  "cost_overrun_risk",
  "market_risk",
] as const;

export async function getDevelopmentDetails(dealId: string): Promise<DevelopmentDetails | null> {
  const [row] = await query<DevelopmentDetails>(`select * from deal_development_details where deal_id = $1`, [dealId]);
  return row ?? null;
}

/** Upserts whatever subset of columns is given -- unset fields keep their existing value. */
export async function upsertDevelopmentDetails(
  dealId: string,
  patch: Partial<Record<(typeof DEVELOPMENT_DETAIL_COLUMNS)[number], unknown>>
): Promise<DevelopmentDetails> {
  const keys = DEVELOPMENT_DETAIL_COLUMNS.filter((k) => k in patch);
  const insertCols = ["deal_id", ...keys];
  const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`);
  const insertValues = [dealId, ...keys.map((k) => patch[k] ?? null)];
  const updateSet = keys.map((k) => `${k} = excluded.${k}`).concat("updated_at = now()").join(", ");

  const [row] = await queryOrThrow<DevelopmentDetails>(
    `insert into deal_development_details (${insertCols.join(", ")})
     values (${insertPlaceholders.join(", ")})
     on conflict (deal_id) do update set ${updateSet}
     returning *`,
    insertValues
  );
  return row;
}

export interface Milestone {
  id: string;
  deal_id: string;
  category: "entitlement_approval" | "budget_change" | "schedule_change" | "other";
  label: string;
  milestone_date: string | null;
  target_date: string | null;
  status: "pending" | "complete" | "delayed" | "at_risk";
  source_document: string | null;
  notes: string | null;
  created_at: string;
}

export async function getMilestones(dealId: string): Promise<Milestone[]> {
  return query<Milestone>(
    `select * from deal_milestones where deal_id = $1 order by coalesce(target_date, milestone_date) nulls last, created_at`,
    [dealId]
  );
}

export async function addMilestone(
  dealId: string,
  input: Pick<Milestone, "category" | "label"> &
    Partial<Pick<Milestone, "milestone_date" | "target_date" | "status" | "source_document" | "notes">>
): Promise<Milestone> {
  const [row] = await queryOrThrow<Milestone>(
    `insert into deal_milestones (deal_id, category, label, milestone_date, target_date, status, source_document, notes)
     values ($1, $2, $3, $4, $5, coalesce($6, 'pending'), $7, $8)
     returning *`,
    [
      dealId,
      input.category,
      input.label,
      input.milestone_date ?? null,
      input.target_date ?? null,
      input.status ?? null,
      input.source_document ?? null,
      input.notes ?? null,
    ]
  );
  return row;
}

export async function updateMilestone(
  id: string,
  dealId: string,
  patch: Partial<Pick<Milestone, "milestone_date" | "target_date" | "status" | "notes">>
): Promise<Milestone | null> {
  const [row] = await query<Milestone>(
    `update deal_milestones set
       milestone_date = coalesce($3, milestone_date),
       target_date = coalesce($4, target_date),
       status = coalesce($5, status),
       notes = coalesce($6, notes)
     where id = $1 and deal_id = $2
     returning *`,
    [id, dealId, patch.milestone_date, patch.target_date, patch.status, patch.notes]
  );
  return row ?? null;
}

export async function deleteMilestone(id: string, dealId: string): Promise<boolean> {
  const deleted = await query<{ id: string }>(`delete from deal_milestones where id = $1 and deal_id = $2 returning id`, [id, dealId]);
  return deleted.length > 0;
}

// --- Per-asset-class development detail tables ---
// One table name per class with a development detail table (see
// DEVELOPMENT_DETAIL_ASSET_CLASSES in lib/dealConstants.ts). Land has none.

export interface IndustrialDevelopmentDetails {
  deal_id: string;
  building_sf: number | null;
  clear_height_ft: number | null;
  dock_doors: number | null;
  trailer_stalls: number | null;
  office_sf: number | null;
  truck_court_depth_ft: number | null;
  delivery_type: "spec" | "build_to_suit" | null;
  bts_tenant_name: string | null;
  bts_tenant_lease_status: string | null;
  bts_lease_term_months: number | null;
  target_tenant_profile: string | null;
  leasing_broker: string | null;
  ios_yard_acreage: number | null;
  ios_yard_stall_count: number | null;
  ios_yard_projected_income: number | null;
}

export interface HospitalityDevelopmentDetails {
  deal_id: string;
  room_count: number | null;
  brand: string | null;
  is_independent: boolean;
  management_company: string | null;
  franchise_agreement_status: string | null;
  franchise_agreement_term_years: number | null;
  fb_amenity_program: string | null;
  projected_adr: number | null;
  projected_occupancy_pct: number | null;
  projected_revpar: number | null;
  pip_cost: number | null;
  is_conversion: boolean;
}

export interface CondoDevelopmentDetails {
  deal_id: string;
  hoa_structure: string | null;
  deposit_escrow_terms: string | null;
  construction_lender_presale_threshold_pct: number | null;
}

export interface RetailDevelopmentDetails {
  deal_id: string;
  building_sf: number | null;
  pad_count: number | null;
  tenant_name: string | null;
  tenant_status: "vacant_spec" | "loi" | "lease_executed" | null;
  lease_term_months: number | null;
  drive_thru: boolean;
  parking_stalls_required: number | null;
  parking_stalls_provided: number | null;
}

type AssetClassDetailTable = {
  industrial: IndustrialDevelopmentDetails;
  hospitality: HospitalityDevelopmentDetails;
  condo: CondoDevelopmentDetails;
  retail: RetailDevelopmentDetails;
};

const TABLE_NAME: Record<keyof AssetClassDetailTable, string> = {
  industrial: "industrial_development_details",
  hospitality: "hospitality_development_details",
  condo: "condo_development_details",
  retail: "retail_development_details",
};

function hasDetailTable(assetClass: AssetClass): assetClass is keyof AssetClassDetailTable {
  return assetClass in TABLE_NAME;
}

export async function getAssetClassDevelopmentDetails<K extends keyof AssetClassDetailTable>(
  dealId: string,
  assetClass: K
): Promise<AssetClassDetailTable[K] | null> {
  const [row] = await query<AssetClassDetailTable[K]>(`select * from ${TABLE_NAME[assetClass]} where deal_id = $1`, [dealId]);
  return row ?? null;
}

/** Upserts whatever subset of columns is given for the asset class's development detail table. */
export async function upsertAssetClassDevelopmentDetails<K extends keyof AssetClassDetailTable>(
  dealId: string,
  assetClass: K,
  patch: Partial<Omit<AssetClassDetailTable[K], "deal_id">>
): Promise<AssetClassDetailTable[K]> {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) {
    const existing = await getAssetClassDevelopmentDetails(dealId, assetClass);
    if (existing) return existing;
    keys.push("deal_id" as never); // fall through to a bare insert below
  }

  const table = TABLE_NAME[assetClass];
  const insertCols = ["deal_id", ...keys.filter((k) => k !== "deal_id")];
  const insertValues = insertCols.map((k) => (k === "deal_id" ? dealId : (patch as Record<string, unknown>)[k as string] ?? null));
  const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`);
  const updateSet =
    insertCols
      .filter((k) => k !== "deal_id")
      .map((k) => `${String(k)} = excluded.${String(k)}`)
      .join(", ") || "deal_id = excluded.deal_id";

  const [row] = await queryOrThrow<AssetClassDetailTable[K]>(
    `insert into ${table} (${insertCols.join(", ")})
     values (${insertPlaceholders.join(", ")})
     on conflict (deal_id) do update set ${updateSet}
     returning *`,
    insertValues
  );
  return row;
}

export function assetClassHasDevelopmentDetailTable(assetClass: AssetClass): boolean {
  return hasDetailTable(assetClass);
}

// --- Condo unit sales pace tracking ---

export interface CondoUnitSalesSnapshot {
  id: string;
  deal_id: string;
  as_of_date: string;
  units_released: number;
  units_under_contract: number;
  units_closed: number;
  created_at: string;
}

export async function getCondoUnitSales(dealId: string): Promise<CondoUnitSalesSnapshot[]> {
  return query<CondoUnitSalesSnapshot>(`select * from condo_unit_sales where deal_id = $1 order by as_of_date`, [dealId]);
}

export async function addCondoUnitSalesSnapshot(
  dealId: string,
  input: Pick<CondoUnitSalesSnapshot, "as_of_date" | "units_released" | "units_under_contract" | "units_closed">
): Promise<CondoUnitSalesSnapshot> {
  const [row] = await queryOrThrow<CondoUnitSalesSnapshot>(
    `insert into condo_unit_sales (deal_id, as_of_date, units_released, units_under_contract, units_closed)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [dealId, input.as_of_date, input.units_released, input.units_under_contract, input.units_closed]
  );
  return row;
}

// Used by the development_stage type import above, re-exported for
// convenience so callers of this module don't need a separate import just
// for the stage type.
export type { DevelopmentStage };
