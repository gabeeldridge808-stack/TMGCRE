import { describe, expect, it } from "vitest";
import { filterDealsByFacets } from "@/lib/dealSearch";

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
