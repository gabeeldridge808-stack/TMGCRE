// Per-asset-class underwriting attribute schemas — the domain model an
// acquisitions/asset-management team actually tracks, not a generic
// key-value bag. This is additive on top of the existing `deal_attributes`
// (deal_id, key, value jsonb) table — see schema.sql — not a replacement
// for it. Nothing here requires a migration: every field just names a key
// that may or may not have a row yet. Two consumers:
//   1. Structured extraction (lib/extractAttributes.ts) — each section
//      below is handed to Claude as the exact shape to fill from document
//      text via Anthropic's structured outputs, one call per section.
//   2. The Attributes UI (app/deals/[id]/page.tsx) — FIELD_META drives
//      grouping/labeling instead of a raw key: value dump.
//
// Every field is optional. Deal data is filled in progressively — at
// sourcing you might have none of this; by IC memo you have most of it —
// and extraction only ever adds what a document actually states (see the
// extraction system prompt), so a schema that required fields would be
// constantly unsatisfiable.
//
// Schemas are split into sections (not one schema per asset class) because
// Claude's structured-outputs schema compiler caps a single request at 24
// optional top-level parameters — a full multifamily schema (deal
// economics + multifamily fields) runs to ~40+.
//
// That documented 24-field cap is NOT the only limit in practice. Live
// testing found a second, undocumented "grammar compilation" cost that
// kicks in well below 24: an 11-field flat section compiled in ~10s, a
// 16-field flat section failed outright ("Schema is too complex."), and a
// 16-field section that also contained one array-of-objects field (e.g.
// unit_mix) failed with "Grammar compilation timed out" after ~180s. So
// sections here are kept small (~7-9 scalar fields) and every
// array-of-objects field (unit_mix, rent_roll, anchor_tenants) is split
// into its own single-field section — bundling a row-shaped field
// alongside other fields is what pushed compilation over the edge. See
// lib/extractAttributes.ts, which makes one extraction call per section.
import { z } from "zod";
import { ASSET_CLASSES, type AssetClass } from "@/lib/dealConstants";

export interface FieldMeta {
  label: string;
  group: string;
  unit?: "$" | "%" | "years" | "sqft" | "x" | "rooms" | "units" | "ac" | "ft";
}

// Single source of truth for display metadata. Keyed by canonical field
// name so a field shared across asset classes (purchase_price, noi, ...)
// is labeled once. Group names double as the section headers rendered in
// the Attributes UI.
export const FIELD_META: Record<string, FieldMeta> = {
  // --- Acquisition ---
  purchase_price: { label: "Purchase Price", group: "Acquisition", unit: "$" },
  price_per_unit: { label: "Price per Unit", group: "Acquisition", unit: "$" },
  price_per_sqft: { label: "Price per SF", group: "Acquisition", unit: "$" },
  price_per_key: { label: "Price per Key", group: "Acquisition", unit: "$" },
  closing_date: { label: "Closing Date", group: "Acquisition" },
  earnest_money_deposit: { label: "Earnest Money Deposit", group: "Acquisition", unit: "$" },
  due_diligence_period_days: { label: "Due Diligence Period", group: "Acquisition" },

  // --- Returns ---
  going_in_cap_rate: { label: "Going-In Cap Rate", group: "Returns", unit: "%" },
  exit_cap_rate: { label: "Exit Cap Rate", group: "Returns", unit: "%" },
  hold_period_years: { label: "Hold Period", group: "Returns", unit: "years" },
  target_irr: { label: "Target IRR", group: "Returns", unit: "%" },
  equity_multiple: { label: "Equity Multiple", group: "Returns", unit: "x" },
  cash_on_cash_return: { label: "Cash-on-Cash Return", group: "Returns", unit: "%" },
  total_equity_required: { label: "Total Equity Required", group: "Returns", unit: "$" },

  // --- Financing ---
  loan_amount: { label: "Loan Amount", group: "Financing", unit: "$" },
  ltv: { label: "LTV", group: "Financing", unit: "%" },
  interest_rate: { label: "Interest Rate", group: "Financing", unit: "%" },
  rate_type: { label: "Rate Type", group: "Financing" },
  amortization_years: { label: "Amortization", group: "Financing", unit: "years" },
  loan_term_years: { label: "Loan Term", group: "Financing", unit: "years" },
  dscr: { label: "DSCR", group: "Financing", unit: "x" },
  lender: { label: "Lender", group: "Financing" },
  rate_lock_date: { label: "Rate Lock Date", group: "Financing" },

  // --- Operations (shared) ---
  noi: { label: "NOI (in-place, trailing)", group: "Operations", unit: "$" },
  opex_ratio: { label: "Operating Expense Ratio", group: "Operations", unit: "%" },
  capex_budget: { label: "Capex Budget", group: "Operations", unit: "$" },
  real_estate_taxes: { label: "Real Estate Taxes", group: "Operations", unit: "$" },
  insurance_expense: { label: "Insurance", group: "Operations", unit: "$" },

  // --- Physical / Location (shared) ---
  year_built: { label: "Year Built", group: "Physical" },
  submarket: { label: "Submarket", group: "Location" },

  // --- Multifamily ---
  unit_count: { label: "Unit Count", group: "Multifamily", unit: "units" },
  unit_mix: { label: "Unit Mix", group: "Multifamily" },
  occupancy_pct: { label: "Occupancy", group: "Multifamily", unit: "%" },
  physical_vacancy_pct: { label: "Physical Vacancy", group: "Multifamily", unit: "%" },
  economic_vacancy_pct: { label: "Economic Vacancy", group: "Multifamily", unit: "%" },
  t12_gross_potential_rent: { label: "T-12 Gross Potential Rent", group: "Multifamily", unit: "$" },
  t12_effective_gross_income: { label: "T-12 Effective Gross Income", group: "Multifamily", unit: "$" },
  t12_operating_expenses: { label: "T-12 Operating Expenses", group: "Multifamily", unit: "$" },
  t12_noi: { label: "T-12 NOI", group: "Multifamily", unit: "$" },
  avg_in_place_rent: { label: "Avg In-Place Rent", group: "Multifamily", unit: "$" },
  avg_market_rent: { label: "Avg Market Rent", group: "Multifamily", unit: "$" },
  rent_growth_assumption_pct: { label: "Rent Growth Assumption", group: "Multifamily", unit: "%" },
  property_class: { label: "Property Class", group: "Multifamily" },
  year_renovated: { label: "Year Renovated", group: "Multifamily" },
  amenities: { label: "Amenities", group: "Multifamily" },

  // --- Office ---
  total_rentable_sqft: { label: "Total Rentable SF", group: "Office", unit: "sqft" },
  wault_years: { label: "WAULT", group: "Office", unit: "years" },
  rent_roll: { label: "Rent Roll", group: "Office" },
  anchor_tenant: { label: "Anchor Tenant", group: "Office" },
  largest_tenant_credit_rating: { label: "Largest Tenant Credit Rating", group: "Office" },
  lease_type: { label: "Lease Type", group: "Office" },
  parking_ratio: { label: "Parking Ratio", group: "Office" },

  // --- Retail ---
  total_gla_sqft: { label: "Total GLA", group: "Retail", unit: "sqft" },
  anchor_tenants: { label: "Anchor Tenants", group: "Retail" },
  percentage_rent_clauses: { label: "Percentage Rent Clauses", group: "Retail" },
  cam_recovery_pct: { label: "CAM Recovery", group: "Retail", unit: "%" },
  avg_sales_per_sqft: { label: "Avg Sales per SF", group: "Retail", unit: "$" },
  co_tenancy_clauses: { label: "Co-Tenancy Clauses", group: "Retail" },
  center_type: { label: "Center Type", group: "Retail" },

  // --- Industrial ---
  total_building_sqft: { label: "Total Building SF", group: "Industrial", unit: "sqft" },
  clear_height_ft: { label: "Clear Height", group: "Industrial", unit: "ft" },
  dock_doors_count: { label: "Dock Doors", group: "Industrial" },
  drive_in_doors_count: { label: "Drive-In Doors", group: "Industrial" },
  column_spacing: { label: "Column Spacing", group: "Industrial" },
  truck_court_depth_ft: { label: "Truck Court Depth", group: "Industrial", unit: "ft" },
  office_finish_pct: { label: "Office Finish", group: "Industrial", unit: "%" },
  lease_term_years: { label: "Lease Term", group: "Industrial", unit: "years" },
  escalation_pct: { label: "Annual Escalation", group: "Industrial", unit: "%" },
  tenant_industry: { label: "Tenant Industry", group: "Industrial" },
  rail_served: { label: "Rail Served", group: "Industrial" },
  sprinkler_type: { label: "Sprinkler Type", group: "Industrial" },

  // --- Hospitality ---
  room_count: { label: "Room Count", group: "Hospitality", unit: "rooms" },
  flag_brand: { label: "Flag / Brand", group: "Hospitality" },
  management_company: { label: "Management Company", group: "Hospitality" },
  adr: { label: "ADR", group: "Hospitality", unit: "$" },
  revpar: { label: "RevPAR", group: "Hospitality", unit: "$" },
  gop_margin_pct: { label: "GOP Margin", group: "Hospitality", unit: "%" },
  franchise_fee_pct: { label: "Franchise Fee", group: "Hospitality", unit: "%" },
  pip_budget: { label: "PIP Budget", group: "Hospitality", unit: "$" },
  star_rating: { label: "Star Rating", group: "Hospitality" },

  // --- Land ---
  acreage: { label: "Acreage", group: "Land", unit: "ac" },
  zoning: { label: "Zoning", group: "Land" },
  entitlement_status: { label: "Entitlement Status", group: "Land" },
  far: { label: "FAR (Floor Area Ratio)", group: "Land" },
  utilities_available: { label: "Utilities Available", group: "Land" },
  topography_notes: { label: "Topography Notes", group: "Land" },
  environmental_status: { label: "Environmental Status", group: "Land" },
  highest_best_use: { label: "Highest & Best Use", group: "Land" },
  planned_units_or_sqft: { label: "Planned Units / SF", group: "Land" },
  planned_use: { label: "Planned Use", group: "Land" },

  // --- Condo Development --- (zoning/entitlement_status/far/acreage above
  // are reused as-is — same real-world concept for a condo site as for
  // raw land — everything else here is specific to a for-sale build.)
  total_units: { label: "Total Units", group: "Condo Development", unit: "units" },
  total_saleable_sqft: { label: "Total Saleable SF", group: "Condo Development", unit: "sqft" },
  avg_unit_sqft: { label: "Avg Unit SF", group: "Condo Development", unit: "sqft" },
  parking_spaces: { label: "Parking Spaces", group: "Condo Development" },
  construction_duration_months: { label: "Construction Duration", group: "Condo Development" },
  sales_period_months: { label: "Sales Period", group: "Condo Development" },
  hard_costs: { label: "Hard Costs", group: "Condo Development", unit: "$" },
  hard_cost_per_sqft: { label: "Hard Cost per SF", group: "Condo Development", unit: "$" },
  soft_costs: { label: "Soft Costs", group: "Condo Development", unit: "$" },
  contingency_pct: { label: "Contingency", group: "Condo Development", unit: "%" },
  developer_fee_pct: { label: "Developer Fee", group: "Condo Development", unit: "%" },
  total_development_cost: { label: "Total Development Cost", group: "Condo Development", unit: "$" },
  construction_loan_amount: { label: "Construction Loan Amount", group: "Condo Development", unit: "$" },
  loan_to_cost_pct: { label: "Loan-to-Cost", group: "Condo Development", unit: "%" },
  construction_interest_rate: { label: "Construction Interest Rate", group: "Condo Development", unit: "%" },
  construction_loan_term_months: { label: "Construction Loan Term", group: "Condo Development" },
  equity_required: { label: "Equity Required", group: "Condo Development", unit: "$" },
  avg_price_per_unit: { label: "Avg Price per Unit", group: "Condo Development", unit: "$" },
  avg_price_per_sqft: { label: "Avg Price per SF", group: "Condo Development", unit: "$" },
  sales_commission_pct: { label: "Sales Commission", group: "Condo Development", unit: "%" },
  absorption_rate_units_per_month: { label: "Absorption Rate", group: "Condo Development", unit: "units" },
  pre_sale_pct: { label: "Pre-Sold", group: "Condo Development", unit: "%" },
  gross_sellout: { label: "Gross Sellout", group: "Condo Development", unit: "$" },
  deposit_structure: { label: "Deposit Structure", group: "Condo Development" },
  condo_unit_mix: { label: "Unit Mix", group: "Condo Development" },
};

// --- Shared deal-economics fields, split into two sections to stay under
// the 24-optional-parameter structured-outputs limit once combined with
// any asset-class section. ---

const acquisitionAndReturns = z.object({
  purchase_price: z.number().describe("Total purchase price in USD"),
  closing_date: z.string().describe("Expected or actual closing date"),
  earnest_money_deposit: z.number().describe("Earnest money / good-faith deposit in USD"),
  due_diligence_period_days: z.number().describe("Length of the due diligence period in days"),
  going_in_cap_rate: z.number().describe("Going-in cap rate as stated, e.g. 5.5 for 5.5%"),
  exit_cap_rate: z.number().describe("Assumed exit/terminal cap rate, e.g. 5.75 for 5.75%"),
  hold_period_years: z.number().describe("Assumed hold period in years"),
  target_irr: z.number().describe("Target or projected IRR, e.g. 15 for 15%"),
  equity_multiple: z.number().describe("Projected equity multiple, e.g. 1.8 for 1.8x"),
  cash_on_cash_return: z.number().describe("Cash-on-cash return, e.g. 7 for 7%"),
  total_equity_required: z.number().describe("Total equity required to close, in USD"),
}).partial();

const financingTerms = z.object({
  loan_amount: z.number().describe("Loan principal amount in USD"),
  ltv: z.number().describe("Loan-to-value ratio, e.g. 65 for 65%"),
  interest_rate: z.number().describe("Interest rate, e.g. 6.25 for 6.25%"),
  rate_type: z.enum(["fixed", "floating"]).describe("Whether the interest rate is fixed or floating"),
  amortization_years: z.number().describe("Amortization schedule in years"),
  loan_term_years: z.number().describe("Loan term in years"),
  dscr: z.number().describe("Debt service coverage ratio, e.g. 1.25 for 1.25x"),
  lender: z.string().describe("Lender name"),
  rate_lock_date: z.string().describe("Rate lock date, if stated"),
}).partial();

const operatingFinancials = z.object({
  noi: z.number().describe("In-place / trailing NOI in USD"),
  opex_ratio: z.number().describe("Operating expenses as a percent of effective gross income"),
  capex_budget: z.number().describe("Planned capital expenditure budget in USD"),
  real_estate_taxes: z.number().describe("Annual real estate tax expense in USD"),
  insurance_expense: z.number().describe("Annual insurance expense in USD"),
  year_built: z.number().describe("Year the property was built"),
  submarket: z.string().describe("Submarket or micro-market name"),
}).partial();

const unitMixRow = z.object({
  unit_type: z.string().describe("e.g. Studio, 1BR/1BA, 2BR/2BA"),
  count: z.number(),
  avg_sqft: z.number().optional(),
  in_place_rent: z.number().optional().describe("Average in-place monthly rent for this unit type"),
  market_rent: z.number().optional().describe("Average market/asking monthly rent for this unit type"),
});

const rentRollRow = z.object({
  tenant_name: z.string(),
  suite: z.string().optional(),
  sqft: z.number().optional(),
  lease_start: z.string().optional(),
  lease_end: z.string().optional(),
  base_rent_psf: z.number().optional().describe("Base rent per square foot per year"),
  escalation_pct: z.number().optional().describe("Annual escalation, e.g. 3 for 3%"),
  renewal_options: z.string().optional(),
});

const anchorTenantRow = z.object({
  tenant_name: z.string(),
  sqft: z.number().optional(),
  sales_per_sqft: z.number().optional(),
  lease_expiration: z.string().optional(),
});

const multifamilyOperations = z.object({
  unit_count: z.number(),
  occupancy_pct: z.number().describe("Physical occupancy, e.g. 94 for 94%"),
  physical_vacancy_pct: z.number(),
  economic_vacancy_pct: z.number().describe("Vacancy loss as a percent of gross potential rent"),
  t12_gross_potential_rent: z.number().describe("Trailing-12-month gross potential rent in USD"),
  t12_effective_gross_income: z.number().describe("Trailing-12-month effective gross income in USD"),
  t12_operating_expenses: z.number().describe("Trailing-12-month total operating expenses in USD"),
  t12_noi: z.number().describe("Trailing-12-month net operating income in USD"),
}).partial();

const multifamilyRents = z.object({
  price_per_unit: z.number().describe("Purchase price divided by unit count"),
  avg_in_place_rent: z.number().describe("Average in-place rent per unit per month, all unit types blended"),
  avg_market_rent: z.number().describe("Average market/asking rent per unit per month, all unit types blended"),
  rent_growth_assumption_pct: z.number(),
  property_class: z.enum(["A", "B", "C", "D"]),
  year_renovated: z.number().optional(),
  amenities: z.array(z.string()).optional(),
}).partial();

const multifamilyUnitMix = z.object({
  unit_mix: z.array(unitMixRow).describe("One row per unit type"),
}).partial();

const officeScalars = z.object({
  price_per_sqft: z.number(),
  total_rentable_sqft: z.number(),
  occupancy_pct: z.number(),
  wault_years: z.number().describe("Weighted average unexpired lease term across the rent roll, in years"),
  anchor_tenant: z.string().optional(),
  largest_tenant_credit_rating: z.string().optional(),
  lease_type: z.enum(["NNN", "gross", "modified_gross"]),
  parking_ratio: z.string().describe('e.g. "3.5 per 1,000 SF"'),
  property_class: z.enum(["A", "B", "C"]),
}).partial();

const officeRentRoll = z.object({
  rent_roll: z.array(rentRollRow).describe("One row per tenant lease"),
}).partial();

const retailScalars = z.object({
  price_per_sqft: z.number(),
  total_gla_sqft: z.number().describe("Total gross leasable area"),
  occupancy_pct: z.number(),
  wault_years: z.number(),
  percentage_rent_clauses: z.string().optional().describe("Description of any percentage-rent lease terms"),
  cam_recovery_pct: z.number().describe("Common area maintenance expense recovery rate, e.g. 95 for 95%"),
  avg_sales_per_sqft: z.number().optional(),
  co_tenancy_clauses: z.string().optional(),
  center_type: z.enum(["strip", "power_center", "lifestyle", "mall", "neighborhood"]),
}).partial();

const retailAnchorTenants = z.object({
  anchor_tenants: z.array(anchorTenantRow),
}).partial();

const industrialPhysical = z.object({
  total_building_sqft: z.number(),
  clear_height_ft: z.number(),
  dock_doors_count: z.number(),
  drive_in_doors_count: z.number().optional(),
  column_spacing: z.string().optional().describe('e.g. "50\' x 50\'"'),
  truck_court_depth_ft: z.number().optional(),
  office_finish_pct: z.number().optional().describe("Percent of building finished as office space"),
}).partial();

const industrialLease = z.object({
  price_per_sqft: z.number(),
  lease_term_years: z.number(),
  escalation_pct: z.number(),
  tenant_industry: z.string().optional(),
  rail_served: z.boolean().optional(),
  sprinkler_type: z.enum(["ESFR", "wet", "dry", "none"]).optional(),
}).partial();

const hospitalitySpecific = z.object({
  price_per_key: z.number().describe("Purchase price divided by room count"),
  room_count: z.number(),
  flag_brand: z.string().describe('e.g. "Marriott", "Hilton", "Independent"'),
  management_company: z.string().optional(),
  adr: z.number().describe("Average daily rate in USD"),
  revpar: z.number().describe("Revenue per available room in USD"),
  occupancy_pct: z.number(),
  gop_margin_pct: z.number().describe("Gross operating profit as a percent of total revenue"),
  franchise_fee_pct: z.number().optional(),
  pip_budget: z.number().optional().describe("Property improvement plan budget required by the brand"),
  star_rating: z.number().optional(),
}).partial();

const landScalars = z.object({
  acreage: z.number(),
  zoning: z.string(),
  entitlement_status: z.enum(["raw", "entitled", "permitted", "under_construction"]),
  far: z.number().optional().describe("Floor area ratio, if zoned/entitled"),
  topography_notes: z.string().optional(),
  environmental_status: z.enum(["none", "phase_1_esa", "phase_2_esa", "remediated"]).optional(),
  highest_best_use: z.string().optional(),
}).partial();

const landPlanning = z.object({
  utilities_available: z.array(z.enum(["water", "sewer", "electric", "gas"])).optional(),
  planned_units_or_sqft: z.number().optional(),
  planned_use: z.enum(["multifamily", "office", "retail", "industrial", "mixed_use"]).optional(),
}).partial();

// --- Condo Development ---
// A for-sale build is underwritten completely differently from every
// income-producing class above: no NOI, no cap rate, no hold period. It's
// a development pro forma (land + hard/soft costs financed by a
// construction loan) resolved by selling units, not a cash-flowing asset
// held for income — see lib/condoUnderwritingModel.ts for the actual math.
// These sections deliberately do NOT reuse acquisitionAndReturns/
// financingTerms/operatingFinancials above; those model a permanent loan
// against in-place income, which doesn't exist here.

const condoSiteAcquisition = z.object({
  purchase_price: z.number().describe("Land acquisition price in USD"),
  closing_date: z.string(),
  earnest_money_deposit: z.number().optional(),
  zoning: z.string().optional(),
  entitlement_status: z.enum(["raw", "entitled", "permitted", "under_construction"]).optional(),
  far: z.number().optional().describe("Floor area ratio"),
  acreage: z.number().optional(),
}).partial();

const condoProgram = z.object({
  total_units: z.number(),
  total_saleable_sqft: z.number(),
  avg_unit_sqft: z.number().optional(),
  parking_spaces: z.number().optional(),
  construction_duration_months: z.number().describe("Months from groundbreaking to completion/certificate of occupancy"),
  sales_period_months: z.number().describe("Months from sales launch to projected sellout"),
}).partial();

const condoCosts = z.object({
  hard_costs: z.number().describe("Total direct construction cost in USD"),
  hard_cost_per_sqft: z.number().optional(),
  soft_costs: z.number().describe("Architecture, engineering, permits, legal, and other non-construction costs in USD"),
  contingency_pct: z.number().describe("Contingency as a percent of hard + soft costs, e.g. 5 for 5%"),
  developer_fee_pct: z.number().optional().describe("Developer fee as a percent of total development cost"),
  total_development_cost: z.number().describe("Land + hard costs + soft costs + contingency + developer fee, in USD"),
}).partial();

const condoFinancing = z.object({
  construction_loan_amount: z.number(),
  loan_to_cost_pct: z.number().describe("Construction loan as a percent of total development cost, e.g. 65 for 65%"),
  construction_interest_rate: z.number().describe("e.g. 8.5 for 8.5%"),
  construction_loan_term_months: z.number(),
  equity_required: z.number().describe("Total equity required (total development cost minus construction loan), in USD"),
}).partial();

const condoSales = z.object({
  avg_price_per_unit: z.number(),
  avg_price_per_sqft: z.number().optional(),
  sales_commission_pct: z.number().describe("Broker/sales commission as a percent of gross sellout, e.g. 5 for 5%"),
  absorption_rate_units_per_month: z.number().optional().describe("Projected sales pace"),
  pre_sale_pct: z.number().optional().describe("Percent of units pre-sold, often required by the construction lender before closing"),
  gross_sellout: z.number().describe("Total projected revenue across all units, in USD"),
  deposit_structure: z.string().optional().describe('e.g. "10% at contract, 10% at groundbreaking, 80% at closing"'),
}).partial();

const condoUnitMixRow = z.object({
  unit_type: z.string().describe("e.g. Studio, 1BR/1BA, 2BR/2BA, Penthouse"),
  count: z.number(),
  avg_sqft: z.number().optional(),
  avg_sale_price: z.number().optional(),
});

const condoUnitMix = z.object({
  condo_unit_mix: z.array(condoUnitMixRow).describe("One row per unit type"),
}).partial();

export interface SchemaSection {
  /** Human-readable, used only in logs/prompts. */
  name: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

// Every asset class gets the three shared deal-economics sections plus its
// own asset-specific sections. Any row-shaped (array-of-objects) field is
// always its own solo section — see the comment above these schemas for why.
export const ASSET_CLASS_SECTIONS = {
  multifamily: [
    { name: "acquisition & returns", schema: acquisitionAndReturns },
    { name: "financing terms", schema: financingTerms },
    { name: "operating financials", schema: operatingFinancials },
    { name: "multifamily operations", schema: multifamilyOperations },
    { name: "multifamily rents", schema: multifamilyRents },
    { name: "multifamily unit mix", schema: multifamilyUnitMix },
  ],
  office: [
    { name: "acquisition & returns", schema: acquisitionAndReturns },
    { name: "financing terms", schema: financingTerms },
    { name: "operating financials", schema: operatingFinancials },
    { name: "office scalars", schema: officeScalars },
    { name: "office rent roll", schema: officeRentRoll },
  ],
  retail: [
    { name: "acquisition & returns", schema: acquisitionAndReturns },
    { name: "financing terms", schema: financingTerms },
    { name: "operating financials", schema: operatingFinancials },
    { name: "retail scalars", schema: retailScalars },
    { name: "retail anchor tenants", schema: retailAnchorTenants },
  ],
  industrial: [
    { name: "acquisition & returns", schema: acquisitionAndReturns },
    { name: "financing terms", schema: financingTerms },
    { name: "operating financials", schema: operatingFinancials },
    { name: "industrial physical", schema: industrialPhysical },
    { name: "industrial lease", schema: industrialLease },
  ],
  hospitality: [
    { name: "acquisition & returns", schema: acquisitionAndReturns },
    { name: "financing terms", schema: financingTerms },
    { name: "operating financials", schema: operatingFinancials },
    { name: "hospitality-specific", schema: hospitalitySpecific },
  ],
  land: [
    { name: "acquisition & returns", schema: acquisitionAndReturns },
    { name: "financing terms", schema: financingTerms },
    { name: "operating financials", schema: operatingFinancials },
    { name: "land scalars", schema: landScalars },
    { name: "land planning", schema: landPlanning },
  ],
  condo: [
    { name: "condo site & acquisition", schema: condoSiteAcquisition },
    { name: "condo development program", schema: condoProgram },
    { name: "condo development costs", schema: condoCosts },
    { name: "condo construction financing", schema: condoFinancing },
    { name: "condo sales & absorption", schema: condoSales },
    { name: "condo unit mix", schema: condoUnitMix },
  ],
} satisfies Record<AssetClass, SchemaSection[]>;

// Whole-schema view (all sections merged) — used for coverage testing and
// anywhere that wants "every field this asset class can have" rather than
// the section split extraction calls per document.
export const ASSET_CLASS_SCHEMAS = {
  multifamily: z.object({ ...acquisitionAndReturns.shape, ...financingTerms.shape, ...operatingFinancials.shape, ...multifamilyOperations.shape, ...multifamilyRents.shape, ...multifamilyUnitMix.shape }),
  office: z.object({ ...acquisitionAndReturns.shape, ...financingTerms.shape, ...operatingFinancials.shape, ...officeScalars.shape, ...officeRentRoll.shape }),
  retail: z.object({ ...acquisitionAndReturns.shape, ...financingTerms.shape, ...operatingFinancials.shape, ...retailScalars.shape, ...retailAnchorTenants.shape }),
  industrial: z.object({ ...acquisitionAndReturns.shape, ...financingTerms.shape, ...operatingFinancials.shape, ...industrialPhysical.shape, ...industrialLease.shape }),
  hospitality: z.object({ ...acquisitionAndReturns.shape, ...financingTerms.shape, ...operatingFinancials.shape, ...hospitalitySpecific.shape }),
  land: z.object({ ...acquisitionAndReturns.shape, ...financingTerms.shape, ...operatingFinancials.shape, ...landScalars.shape, ...landPlanning.shape }),
  condo: z.object({ ...condoSiteAcquisition.shape, ...condoProgram.shape, ...condoCosts.shape, ...condoFinancing.shape, ...condoSales.shape, ...condoUnitMix.shape }),
} satisfies Record<AssetClass, z.ZodType>;

export function getSchemaSectionsForAssetClass(assetClass: string): SchemaSection[] | undefined {
  if ((ASSET_CLASSES as readonly string[]).includes(assetClass)) {
    return ASSET_CLASS_SECTIONS[assetClass as AssetClass];
  }
  return undefined;
}
