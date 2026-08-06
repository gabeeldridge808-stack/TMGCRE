// Must match the check constraints in schema.sql exactly — these aren't
// re-derived from the database at runtime, so a schema change means
// updating both places.
export const ASSET_CLASSES = ["multifamily", "hospitality", "land", "office", "retail", "industrial"] as const;
export const STAGES = ["sourcing", "underwriting", "diligence", "closing", "closed", "dead"] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];
export type Stage = (typeof STAGES)[number];

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
