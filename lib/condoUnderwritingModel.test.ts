import { describe, expect, it } from "vitest";
import {
  runCondoUnderwritingModel,
  deriveCondoInputsFromAttributes,
  type CondoUnderwritingInputs,
} from "@/lib/condoUnderwritingModel";

const baseInputs: CondoUnderwritingInputs = {
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
};

describe("runCondoUnderwritingModel", () => {
  it("computes the full development pro forma against a hand-checked scenario", () => {
    const r = runCondoUnderwritingModel(baseInputs);

    expect(r.contingencyAmount).toBeCloseTo(600_000, 2);
    expect(r.developerFeeAmount).toBeCloseTo(584_000, 2);
    expect(r.totalDevelopmentCost).toBeCloseTo(15_184_000, 2);
    expect(r.constructionLoanAmount).toBeCloseTo(9_869_600, 2);
    expect(r.equityRequired).toBeCloseTo(5_314_400, 2);
    expect(r.estimatedConstructionLoanInterest).toBeCloseTo(1_332_396, 2);
    expect(r.totalProjectCost).toBeCloseTo(16_516_396, 2);
    expect(r.grossSellout).toBe(25_000_000);
    expect(r.salesCommissionAmount).toBe(1_250_000);
    expect(r.netSalesRevenue).toBe(23_750_000);
    expect(r.netProfit).toBeCloseTo(7_233_604, 2);
    expect(r.profitMarginOnCostPct).toBeCloseTo(43.7965, 3);
    expect(r.profitMarginOnRevenuePct).toBeCloseTo(28.9344, 3);
    expect(r.equityMultiple).toBeCloseTo(2.3611, 3);
    expect(r.projectIrrPct).toBeCloseTo(33.1599, 3);
    expect(r.totalProjectDurationMonths).toBe(36);
  });

  it("returns a null IRR (not NaN or Infinity) when the project loses more than all the equity", () => {
    const r = runCondoUnderwritingModel({
      ...baseInputs,
      avgPricePerUnit: 100, // sellout far below cost -> deeply negative profit
    });
    expect(r.netProfit).toBeLessThan(0);
    expect(r.projectIrrPct).toBeNull();
  });

  it("handles zero equity (100% loan-to-cost) without dividing by zero", () => {
    const r = runCondoUnderwritingModel({ ...baseInputs, loanToCostPct: 100 });
    expect(r.equityRequired).toBe(0);
    expect(r.equityMultiple).toBe(0);
    expect(r.projectIrrPct).toBeNull();
  });

  it("a longer timeline lowers the annualized IRR for the same total profit multiple", () => {
    const shortTimeline = runCondoUnderwritingModel({ ...baseInputs, constructionDurationMonths: 12, salesPeriodMonths: 6 });
    const longTimeline = runCondoUnderwritingModel({ ...baseInputs, constructionDurationMonths: 36, salesPeriodMonths: 24 });
    expect(longTimeline.projectIrrPct!).toBeLessThan(shortTimeline.projectIrrPct!);
  });
});

describe("deriveCondoInputsFromAttributes", () => {
  it("pulls known numeric fields", () => {
    const derived = deriveCondoInputsFromAttributes([
      { key: "purchase_price", value: 2_000_000 },
      { key: "hard_costs", value: 10_000_000 },
      { key: "total_units", value: 50 },
      { key: "avg_price_per_unit", value: 500_000 },
    ]);

    expect(derived.landCost).toBe(2_000_000);
    expect(derived.hardCosts).toBe(10_000_000);
    expect(derived.totalUnits).toBe(50);
    expect(derived.avgPricePerUnit).toBe(500_000);
    expect(derived.softCosts).toBeUndefined();
  });

  it("returns an empty object when nothing is known", () => {
    expect(deriveCondoInputsFromAttributes([])).toEqual({});
  });
});
