import { describe, expect, it } from "vitest";
import { ASSET_CLASS_SCHEMAS, FIELD_META, getSchemaSectionsForAssetClass } from "@/lib/attributeSchemas";
import { ASSET_CLASSES } from "@/lib/dealConstants";

// Claude's structured-outputs schema compiler rejects a request with more
// than this many optional top-level parameters — see the comment at the
// top of lib/attributeSchemas.ts. Every section must stay under it.
const MAX_OPTIONAL_PARAMS = 24;

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

  it("keeps every section under Claude's optional-parameter limit", () => {
    for (const assetClass of ASSET_CLASSES) {
      for (const section of getSchemaSectionsForAssetClass(assetClass)!) {
        const fieldCount = Object.keys(section.schema.shape).length;
        expect(fieldCount, `${assetClass} / ${section.name}`).toBeLessThanOrEqual(MAX_OPTIONAL_PARAMS);
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
