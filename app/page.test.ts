import { describe, expect, it } from "vitest";
import { filterDealsByQuery } from "@/lib/dealSearch";

describe("filterDealsByQuery", () => {
  it("matches across multiple fields and ignores empty searches", () => {
    const deals = [
      { id: "1", name: "Harbor Point", asset_class: "Multifamily", stage: "Underwriting", owner: "Mina" },
      { id: "2", name: "Oak Tower", asset_class: "Hospitality", stage: "Sourcing", owner: "Jules" },
    ];

    expect(filterDealsByQuery(deals, "harbor")).toEqual([deals[0]]);
    expect(filterDealsByQuery(deals, "sourcing")).toEqual([deals[1]]);
    expect(filterDealsByQuery(deals, "   ")).toEqual(deals);
  });
});
