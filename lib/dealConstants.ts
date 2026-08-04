// Must match the check constraints in schema.sql exactly — these aren't
// re-derived from the database at runtime, so a schema change means
// updating both places.
export const ASSET_CLASSES = ["multifamily", "hospitality", "land", "office", "retail", "industrial"] as const;
export const STAGES = ["sourcing", "underwriting", "diligence", "closing", "closed", "dead"] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];
export type Stage = (typeof STAGES)[number];

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
