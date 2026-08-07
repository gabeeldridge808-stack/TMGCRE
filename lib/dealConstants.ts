// Must match the check constraints in schema.sql exactly — these aren't
// re-derived from the database at runtime, so a schema change means
// updating both places.
export const ASSET_CLASSES = ["multifamily", "hospitality", "land", "office", "retail", "industrial", "condo"] as const;
export const STAGES = ["sourcing", "underwriting", "diligence", "closing", "closed", "dead"] as const;
export const DEAL_CATEGORIES = ["acquisition", "development"] as const;
export const DEVELOPMENT_STAGES = [
  "site_control_diligence",
  "entitlement",
  "design_permitting",
  "construction",
  "lease_up_sellout_stabilization",
] as const;
// Asset classes with a dedicated development detail table (lib/development.ts).
// Land intentionally has none -- its existing deal_attributes land_scalars/
// land_planning sections already cover entitlement_status/planned_use/far/
// acreage, so a development deal on raw land uses only the shared
// deal_development_details + deal_milestones tables.
export const DEVELOPMENT_DETAIL_ASSET_CLASSES = ["industrial", "hospitality", "condo", "retail"] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];
export type Stage = (typeof STAGES)[number];
export type DealCategory = (typeof DEAL_CATEGORIES)[number];
export type DevelopmentStage = (typeof DEVELOPMENT_STAGES)[number];

// Which badge color reads a stage at a glance — a quick visual signal of
// where a deal sits in the pipeline (active/blue, caution/amber,
// won/green, lost/red) rather than one flat color for every stage.
export const STAGE_BADGE_VARIANT: Record<Stage, "neutral" | "info" | "warning" | "success" | "danger"> = {
  sourcing: "neutral",
  underwriting: "info",
  diligence: "warning",
  closing: "info",
  closed: "success",
  dead: "danger",
};

// titleCase() alone renders "Lease Up Sellout Stabilization" -- readable but
// not how anyone would say it. Explicit labels for the development-stage
// slugs specifically, same idea as STAGE_BADGE_VARIANT above.
export const DEVELOPMENT_STAGE_LABELS: Record<DevelopmentStage, string> = {
  site_control_diligence: "Site Control / Diligence",
  entitlement: "Entitlement",
  design_permitting: "Design / Permitting",
  construction: "Construction",
  lease_up_sellout_stabilization: "Lease-Up / Sellout / Stabilization",
};

export const DEVELOPMENT_STAGE_BADGE_VARIANT: Record<DevelopmentStage, "neutral" | "info" | "warning" | "success" | "danger"> = {
  site_control_diligence: "neutral",
  entitlement: "warning",
  design_permitting: "info",
  construction: "info",
  lease_up_sellout_stabilization: "success",
};

export function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Mime types the direct-upload pipeline (lib/documents.ts) can extract text
// from. Client-safe (no Node-only deps) so both the upload UI's `accept`
// attribute and the server-side extractor validate against the same list.
// Google Docs aren't here — that mime type only ever appears via the Drive
// ingest path (lib/gdrive.ts), never from a browser file picker.
export const DOCUMENT_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
} as const;

export const UPLOADABLE_MIME_TYPES = Object.values(DOCUMENT_MIME_TYPES);
