import { describe, expect, it } from "vitest";
import { ASSET_CLASS_SCHEMAS, FIELD_META, getSchemaSectionsForAssetClass } from "@/lib/attributeSchemas";
import { ASSET_CLASSES } from "@/lib/dealConstants";

// Claude's structured-outputs schema compiler documents a 24-optional-param
// cap, but live testing found real failures well below that (a 16-field
// flat section failed with "Schema is too complex.") — see the comment at
// the top of lib/attributeSchemas.ts. This is an empirically-set, stricter
// safety margin, not the documented API limit.
const MAX_OPTIONAL_PARAMS = 12;

describe("getSchemaSectionsForAssetClass", () => {
  it("returns sections for every asset class in the shared enum", () => {
    for (const assetClass of ASSET_CLASSES) {
      const sections = getSchemaSectionsForAssetClass(assetClass);
      expect(sections).toBeDefined();
      expect(sections!.length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for an unknown asset class", () => {
    expect(getSchemaSectionsForAssetClass("bogus")).toBeUndefined();
  });

  it("keeps every section under the empirical optional-parameter limit", () => {
    for (const assetClass of ASSET_CLASSES) {
      for (const section of getSchemaSectionsForAssetClass(assetClass)!) {
        const fieldCount = Object.keys(section.schema.shape).length;
        expect(fieldCount, `${assetClass} / ${section.name}`).toBeLessThanOrEqual(MAX_OPTIONAL_PARAMS);
      }
    }
  });

  it("keeps any array-of-objects field alone in its own section", () => {
    // Bundling a row-shaped field (unit_mix, rent_roll, ...) with other
    // fields is what caused "Grammar compilation timed out" in production —
    // see the comment at the top of lib/attributeSchemas.ts.
    for (const assetClass of ASSET_CLASSES) {
      for (const section of getSchemaSectionsForAssetClass(assetClass)!) {
        const shape = section.schema.shape;
        const fieldEntries = Object.entries(shape) as [string, { unwrap?: () => { def?: { type?: string } } }][];
        const arrayFields = fieldEntries.filter(([, field]) => {
          const inner = field.unwrap?.();
          return inner?.def?.type === "array";
        });
        if (arrayFields.length > 0) {
          expect(fieldEntries.length, `${assetClass} / ${section.name}`).toBe(1);
        }
      }
    }
  });
});

describe("FIELD_META coverage", () => {
  it("has display metadata for every field in every asset-class schema", () => {
    const missing: string[] = [];
    for (const [assetClass, schema] of Object.entries(ASSET_CLASS_SCHEMAS)) {
      for (const key of Object.keys(schema.shape)) {
        if (!FIELD_META[key]) missing.push(`${assetClass}.${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
