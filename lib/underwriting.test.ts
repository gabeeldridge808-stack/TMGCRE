import { describe, expect, it } from "vitest";
import { computeUnderwritingChecks } from "@/lib/underwriting";

describe("computeUnderwritingChecks", () => {
  it("flags a stated cap rate that doesn't reconcile with NOI / price", () => {
    const checks = computeUnderwritingChecks([
      { key: "purchase_price", value: 10_000_000 },
      { key: "noi", value: 450_000 }, // implies 4.5%
      { key: "going_in_cap_rate", value: 5.5 }, // OM claims 5.5%
    ]);

    const capRateCheck = checks.find((c) => c.label.startsWith("Implied Cap Rate"));
    expect(capRateCheck?.value).toBe("4.50%");
    expect(capRateCheck?.flag).toContain("5.5%");
  });

  it("does not flag when the stated and implied cap rate reconcile", () => {
    const checks = computeUnderwritingChecks([
      { key: "purchase_price", value: 10_000_000 },
      { key: "noi", value: 550_000 },
      { key: "going_in_cap_rate", value: 5.5 },
    ]);

    const capRateCheck = checks.find((c) => c.label.startsWith("Implied Cap Rate"));
    expect(capRateCheck?.flag).toBeUndefined();
  });

  it("flags DSCR below the typical 1.20x lender minimum", () => {
    const checks = computeUnderwritingChecks([
      { key: "noi", value: 400_000 },
      { key: "loan_amount", value: 7_000_000 },
      { key: "interest_rate", value: 7 },
      { key: "amortization_years", value: 30 },
    ]);

    const dscrCheck = checks.find((c) => c.label === "Implied DSCR");
    expect(dscrCheck).toBeDefined();
    expect(dscrCheck?.flag).toContain("1.20x");
  });

  it("computes price per unit when purchase price and unit count are present", () => {
    const checks = computeUnderwritingChecks([
      { key: "purchase_price", value: 21_200_000 },
      { key: "unit_count", value: 212 },
    ]);

    expect(checks.find((c) => c.label === "Price per Unit")?.value).toBe("$100,000");
  });

  it("returns no checks when nothing computable is present", () => {
    expect(computeUnderwritingChecks([{ key: "submarket", value: "Uptown" }])).toEqual([]);
  });
});
