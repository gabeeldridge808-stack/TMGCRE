import { describe, expect, it } from "vitest";
import { buildMemoUserMessage, type MemoDealContext, type MemoComp } from "@/lib/icMemo";
import { runUnderwritingModel } from "@/lib/underwritingModel";

const underwriting = runUnderwritingModel({
  purchasePrice: 1_000_000,
  closingCostsPct: 2,
  goingInNoi: 80_000,
  noiGrowthPct: 3,
  holdPeriodYears: 5,
  exitCapRate: 7,
  sellingCostsPct: 2,
  loanToValuePct: 65,
  interestRatePct: 6,
  amortizationYears: 30,
});

describe("buildMemoUserMessage", () => {
  it("includes deal name, attributes, and underwriting figures", () => {
    const deal: MemoDealContext = {
      name: "Harbor Point",
      assetClass: "multifamily",
      stage: "underwriting",
      owner: "Jane",
      attributes: [{ key: "unit_count", value: 120 }],
    };

    const message = buildMemoUserMessage(deal, underwriting, []);

    expect(message).toContain("Harbor Point");
    expect(message).toContain("unit_count: 120");
    expect(message).toContain("Going-in cap rate");
    expect(message).toContain("(no comps imported for this deal)");
  });

  it("formats comps when present", () => {
    const deal: MemoDealContext = { name: "D", assetClass: "office", stage: "sourcing", owner: "X", attributes: [] };
    const comps: MemoComp[] = [
      { property_name: "Oak Tower", sale_price: "1250000", price_per_sqft: "285", price_per_unit: null, cap_rate: "5.5" },
    ];

    const message = buildMemoUserMessage(deal, underwriting, comps);

    expect(message).toContain("Oak Tower");
    expect(message).toContain("$285/SF");
    expect(message).toContain("5.50% cap");
  });
});
