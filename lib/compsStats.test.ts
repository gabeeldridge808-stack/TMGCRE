import { describe, expect, it } from "vitest";
import { computeCompsSummary } from "@/lib/compsStats";

describe("computeCompsSummary", () => {
  it("averages numeric fields, ignoring missing values", () => {
    const summary = computeCompsSummary([
      { price_per_sqft: 200, price_per_unit: 150000, cap_rate: 5.5 },
      { price_per_sqft: 220, price_per_unit: null, cap_rate: 6.0 },
      { price_per_sqft: undefined, price_per_unit: 170000, cap_rate: undefined },
    ]);

    expect(summary.count).toBe(3);
    expect(summary.avgPricePerSqft).toBe(210);
    expect(summary.avgPricePerUnit).toBe(160000);
    expect(summary.avgCapRate).toBeCloseTo(5.75, 5);
  });

  it("returns null averages and zero count for an empty list", () => {
    const summary = computeCompsSummary([]);
    expect(summary).toEqual({ count: 0, avgPricePerSqft: null, avgPricePerUnit: null, avgCapRate: null });
  });
});
