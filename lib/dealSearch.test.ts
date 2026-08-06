import { describe, expect, it } from "vitest";
import { filterDealsByFacets, paginate } from "@/lib/dealSearch";

describe("filterDealsByFacets", () => {
  const deals = [
    { id: "1", name: "Harbor Point", asset_class: "multifamily", stage: "underwriting" },
    { id: "2", name: "Oak Tower", asset_class: "hospitality", stage: "sourcing" },
    { id: "3", name: "Cedar Plaza", asset_class: "multifamily", stage: "sourcing" },
  ];

  it("returns all deals when no facets are given", () => {
    expect(filterDealsByFacets(deals, {})).toEqual(deals);
  });

  it("filters by asset class alone", () => {
    expect(filterDealsByFacets(deals, { assetClass: "multifamily" })).toEqual([deals[0], deals[2]]);
  });

  it("filters by stage alone", () => {
    expect(filterDealsByFacets(deals, { stage: "sourcing" })).toEqual([deals[1], deals[2]]);
  });

  it("combines both facets", () => {
    expect(filterDealsByFacets(deals, { assetClass: "multifamily", stage: "sourcing" })).toEqual([deals[2]]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it("slices the requested page", () => {
    const result = paginate(items, 1, 10);
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.totalPages).toBe(3);
    expect(result.totalItems).toBe(23);
  });

  it("returns the last partial page", () => {
    const result = paginate(items, 3, 10);
    expect(result.items).toEqual([21, 22, 23]);
  });

  it("clamps an out-of-range page instead of returning empty", () => {
    const result = paginate(items, 99, 10);
    expect(result.page).toBe(3);
    expect(result.items).toEqual([21, 22, 23]);
  });

  it("clamps page 0 or negative up to page 1", () => {
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate(items, -5, 10).page).toBe(1);
  });

  it("always reports at least 1 total page for an empty list", () => {
    const result = paginate([], 1, 10);
    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
  });
});
