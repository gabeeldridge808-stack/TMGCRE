import { describe, expect, it } from "vitest";
import { ASSET_CLASS_SCHEMAS, FIELD_META, getSchemaForAssetClass } from "@/lib/attributeSchemas";
import { ASSET_CLASSES } from "@/lib/dealConstants";

describe("getSchemaForAssetClass", () => {
  it("returns a schema for every asset class in the shared enum", () => {
    for (const assetClass of ASSET_CLASSES) {
      expect(getSchemaForAssetClass(assetClass)).toBeDefined();
    }
  });

  it("returns undefined for an unknown asset class", () => {
    expect(getSchemaForAssetClass("bogus")).toBeUndefined();
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
