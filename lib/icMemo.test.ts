import { describe, expect, it } from "vitest";
import {
  buildMemoUserMessage,
  formatIncomeUnderwritingSummary,
  formatCondoUnderwritingSummary,
  type MemoDealContext,
  type MemoComp,
} from "@/lib/icMemo";
import { runUnderwritingModel } from "@/lib/underwritingModel";
import { runCondoUnderwritingModel } from "@/lib/condoUnderwritingModel";

const underwritingSummary = formatIncomeUnderwritingSummary(
  runUnderwritingModel({
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
  })
);

describe("buildMemoUserMessage", () => {
  it("includes deal name, attributes, and underwriting figures", () => {
    const deal: MemoDealContext = {
      name: "Harbor Point",
      assetClass: "multifamily",
      stage: "underwriting",
      ownerName: "Jane",
      attributes: [{ key: "unit_count", value: 120 }],
    };

    const message = buildMemoUserMessage(deal, underwritingSummary, []);

    expect(message).toContain("Harbor Point");
    expect(message).toContain("unit_count: 120");
    expect(message).toContain("Going-in cap rate");
    expect(message).toContain("(no comps imported for this deal)");
  });

  it("formats comps when present", () => {
    const deal: MemoDealContext = { name: "D", assetClass: "office", stage: "sourcing", ownerName: "X", attributes: [] };
    const comps: MemoComp[] = [
      { property_name: "Oak Tower", sale_price: "1250000", price_per_sqft: "285", price_per_unit: null, cap_rate: "5.5" },
    ];

    const message = buildMemoUserMessage(deal, underwritingSummary, comps);

    expect(message).toContain("Oak Tower");
    expect(message).toContain("$285/SF");
    expect(message).toContain("5.50% cap");
  });

  it("uses the condo development summary for a condo deal, with no cap rate/NOI language", () => {
    const condoSummary = formatCondoUnderwritingSummary(
      runCondoUnderwritingModel({
        landCost: 2_000_000,
        hardCosts: 10_000_000,
        softCosts: 2_000_000,
        contingencyPct: 5,
        developerFeePct: 4,
        loanToCostPct: 65,
        constructionInterestRatePct: 9,
        constructionDurationMonths: 24,
        salesPeriodMonths: 12,
        totalUnits: 50,
        avgPricePerUnit: 500_000,
        salesCommissionPct: 5,
      })
    );
    const deal: MemoDealContext = { name: "Marina Condos", assetClass: "condo", stage: "underwriting", ownerName: "Jane", attributes: [] };

    const message = buildMemoUserMessage(deal, condoSummary, []);

    expect(message).toContain("Marina Condos");
    expect(message).toContain("Gross sellout");
    expect(message).toContain("Total development cost");
    expect(message).not.toContain("Going-in cap rate");
  });
});
