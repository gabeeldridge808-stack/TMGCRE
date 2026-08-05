// Pure underwriting sanity checks computed from whatever deal_attributes
// are already present. Deliberately NOT a full multi-year proforma/IRR
// model — that's real, separate work (see the roadmap in README). This is
// the handful of ratios an analyst checks first, computed from single-point
// figures already in the schema: does the stated cap rate reconcile with
// NOI/price, does debt service leave coverage, what's the price per unit.
export interface UnderwritingCheck {
  label: string;
  value: string;
  /** Set when a computed figure doesn't reconcile with a stated one, or trips a common lender threshold. */
  flag?: string;
}

/** Standard amortizing-loan annual debt service. Returns null for a degenerate rate/term. */
function annualDebtService(loanAmount: number, annualRatePct: number, amortYears: number): number | null {
  const monthlyRate = annualRatePct / 100 / 12;
  const numPayments = amortYears * 12;
  if (monthlyRate <= 0 || numPayments <= 0) return null;
  const monthlyPayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments));
  return monthlyPayment * 12;
}

export function computeUnderwritingChecks(
  attributes: { key: string; value: unknown }[]
): UnderwritingCheck[] {
  const byKey = new Map(attributes.map((a) => [a.key, a.value]));
  const num = (key: string): number | undefined => {
    const v = byKey.get(key);
    return typeof v === "number" ? v : undefined;
  };

  const checks: UnderwritingCheck[] = [];

  const purchasePrice = num("purchase_price");
  const noi = num("noi") ?? num("t12_noi");
  const loanAmount = num("loan_amount");
  const interestRate = num("interest_rate");
  const amortYears = num("amortization_years");
  const goingInCapRate = num("going_in_cap_rate");
  const totalEquity = num("total_equity_required");

  if (purchasePrice && noi) {
    const impliedCapRate = (noi / purchasePrice) * 100;
    checks.push({
      label: "Implied Cap Rate (NOI ÷ Price)",
      value: `${impliedCapRate.toFixed(2)}%`,
      flag:
        goingInCapRate !== undefined && Math.abs(impliedCapRate - goingInCapRate) > 0.15
          ? `Stated going-in cap rate is ${goingInCapRate}% — doesn't reconcile with NOI ÷ price`
          : undefined,
    });
  }

  let debtService: number | null = null;
  if (loanAmount && interestRate && amortYears) {
    debtService = annualDebtService(loanAmount, interestRate, amortYears);
    if (debtService && noi) {
      const dscr = noi / debtService;
      checks.push({
        label: "Implied DSCR",
        value: `${dscr.toFixed(2)}x`,
        flag: dscr < 1.2 ? "Below the typical 1.20x lender minimum" : undefined,
      });
    }
  }

  if (noi && debtService) {
    const equity = totalEquity ?? (purchasePrice && loanAmount ? purchasePrice - loanAmount : undefined);
    if (equity && equity > 0) {
      const cashOnCash = ((noi - debtService) / equity) * 100;
      checks.push({ label: "Implied Cash-on-Cash", value: `${cashOnCash.toFixed(2)}%` });
    }
  }

  const unitCount = num("unit_count");
  if (purchasePrice && unitCount) {
    checks.push({ label: "Price per Unit", value: `$${Math.round(purchasePrice / unitCount).toLocaleString()}` });
  }

  const sqft = num("total_rentable_sqft") ?? num("total_building_sqft") ?? num("total_gla_sqft");
  if (purchasePrice && sqft) {
    checks.push({ label: "Price per SF", value: `$${(purchasePrice / sqft).toFixed(2)}` });
  }

  const roomCount = num("room_count");
  if (purchasePrice && roomCount) {
    checks.push({ label: "Price per Key", value: `$${Math.round(purchasePrice / roomCount).toLocaleString()}` });
  }

  return checks;
}
