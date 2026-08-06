import { describe, expect, it } from "vitest";
import { buildSensitivityGrid, computeIrr, deriveInputsFromAttributes, runUnderwritingModel } from "@/lib/underwritingModel";

describe("computeIrr", () => {
  it("solves a simple two-period cash flow", () => {
    expect(computeIrr([-100, 110])).toBeCloseTo(10, 1);
  });

  it("returns null when cash flows never cross zero", () => {
    expect(computeIrr([100, 100, 100])).toBeNull();
  });
});

describe("runUnderwritingModel", () => {
  it("matches a par-bond IRR for an all-cash deal with no growth and a flat exit cap rate", () => {
    const results = runUnderwritingModel({
      purchasePrice: 1_000_000,
      closingCostsPct: 0,
      goingInNoi: 80_000,
      noiGrowthPct: 0,
      holdPeriodYears: 5,
      exitCapRate: 8,
      sellingCostsPct: 0,
      loanToValuePct: 0,
      interestRatePct: 0,
      amortizationYears: 0,
    });

    expect(results.goingInCapRate).toBeCloseTo(8, 5);
    expect(results.equityRequired).toBe(1_000_000);
    expect(results.exitSalePrice).toBe(1_000_000);
    // No growth + flat exit cap rate + no transaction costs == holding a par
    // bond at the going-in cap rate's coupon: IRR must equal that rate.
    expect(results.unleveredIrrPct).toBeCloseTo(8, 1);
    expect(results.leveredIrrPct).toBeCloseTo(8, 1); // no leverage — same as unlevered
    expect(results.equityMultiple).toBeCloseTo(1.4, 2);
  });

  it("shows positive leverage lifting levered IRR above unlevered when going-in cap rate exceeds the interest rate", () => {
    const results = runUnderwritingModel({
      purchasePrice: 1_000_000,
      closingCostsPct: 0,
      goingInNoi: 80_000,
      noiGrowthPct: 0,
      holdPeriodYears: 5,
      exitCapRate: 8,
      sellingCostsPct: 0,
      loanToValuePct: 65,
      interestRatePct: 5,
      amortizationYears: 0, // interest-only, for a clean hand-checkable result
    });

    expect(results.loanAmount).toBe(650_000);
    expect(results.equityRequired).toBe(350_000);
    expect(results.annualDebtService).toBeCloseTo(32_500, 5);
    expect(results.dscr).toBeCloseTo(80_000 / 32_500, 5);
    // Constant 47,500/yr coupon on 350k equity, full principal-equivalent
    // returned at exit (interest-only, flat exit price) => IRR == coupon rate.
    expect(results.leveredIrrPct).toBeCloseTo((47_500 / 350_000) * 100, 1);
    expect(results.leveredIrrPct!).toBeGreaterThan(results.unleveredIrrPct!);
  });

  it("amortizes principal so the exit-year loan payoff is below the original loan amount", () => {
    const results = runUnderwritingModel({
      purchasePrice: 1_000_000,
      closingCostsPct: 0,
      goingInNoi: 80_000,
      noiGrowthPct: 2,
      holdPeriodYears: 5,
      exitCapRate: 7.5,
      sellingCostsPct: 2,
      loanToValuePct: 65,
      interestRatePct: 5.5,
      amortizationYears: 30,
    });

    expect(results.loanPayoffAtExit).toBeLessThan(results.loanAmount);
    expect(results.loanPayoffAtExit).toBeGreaterThan(0);
    expect(results.yearlyProjections).toHaveLength(5);
    expect(results.yearlyProjections[4].noi).toBeGreaterThan(results.yearlyProjections[0].noi);
  });
});

describe("deriveInputsFromAttributes", () => {
  it("pulls known numeric fields and derives LTV from loan amount / purchase price", () => {
    const derived = deriveInputsFromAttributes([
      { key: "purchase_price", value: 1_000_000 },
      { key: "t12_noi", value: 75_000 },
      { key: "loan_amount", value: 650_000 },
      { key: "interest_rate", value: 5.5 },
    ]);

    expect(derived.purchasePrice).toBe(1_000_000);
    expect(derived.goingInNoi).toBe(75_000);
    expect(derived.loanToValuePct).toBeCloseTo(65, 5);
    expect(derived.interestRatePct).toBe(5.5);
    expect(derived.holdPeriodYears).toBeUndefined();
  });

  it("returns an empty object when nothing is known", () => {
    expect(deriveInputsFromAttributes([])).toEqual({});
  });
});

describe("buildSensitivityGrid", () => {
  const baseInputs = {
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
  };

  it("is a 5x5 grid centered on the base case", () => {
    const grid = buildSensitivityGrid(baseInputs);

    expect(grid.exitCapRates).toEqual([6, 6.5, 7, 7.5, 8]);
    expect(grid.holdPeriods).toEqual([3, 4, 5, 6, 7]);
    expect(grid.leveredIrrGrid).toHaveLength(5);
    expect(grid.leveredIrrGrid[2]).toHaveLength(5);

    // Center cell (base hold period, base exit cap) must match a direct run.
    const centerIrr = grid.leveredIrrGrid[2][2];
    const directIrr = runUnderwritingModel(baseInputs).leveredIrrPct;
    expect(centerIrr).toBeCloseTo(directIrr!, 5);
  });

  it("shows IRR falling as the exit cap rate rises, holding hold period fixed", () => {
    const grid = buildSensitivityGrid(baseInputs);
    const rowAtBaseHoldPeriod = grid.leveredIrrGrid[2];
    for (let i = 1; i < rowAtBaseHoldPeriod.length; i++) {
      expect(rowAtBaseHoldPeriod[i]!).toBeLessThan(rowAtBaseHoldPeriod[i - 1]!);
    }
  });

  it("never produces a hold period below 1 year even with an extreme base case", () => {
    const grid = buildSensitivityGrid({ ...baseInputs, holdPeriodYears: 1 });
    expect(Math.min(...grid.holdPeriods)).toBeGreaterThanOrEqual(1);
  });
});
