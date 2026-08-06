// A high-level acquisition underwriting model — the quick single-scenario
// pro forma an acquisitions analyst runs before building a full multi-tab
// Excel model: constant NOI growth, a cap-rate exit, one loan. It does not
// model unit-by-unit rent roll-up, lease-by-lease rollover, waterfall
// promote structures, or a monthly schedule — see lib/underwriting.ts for
// the (separate, simpler) point-in-time sanity checks computed from stored
// deal_attributes. This module is the interactive "what-if" calculator
// behind the deal page's Underwriting tab: a user supplies assumptions
// directly (pre-filled from deal_attributes where available) and gets a
// full hold-period projection back.
export interface UnderwritingInputs {
  purchasePrice: number;
  closingCostsPct: number;
  goingInNoi: number;
  noiGrowthPct: number;
  holdPeriodYears: number;
  exitCapRate: number;
  sellingCostsPct: number;
  loanToValuePct: number;
  interestRatePct: number;
  /** 0 (or omitted) means interest-only. */
  amortizationYears: number;
}

export interface YearlyProjection {
  year: number;
  noi: number;
  debtService: number;
  cashFlowBeforeTax: number;
  cashOnCashPct: number;
}

export interface UnderwritingResults {
  totalProjectCost: number;
  loanAmount: number;
  equityRequired: number;
  goingInCapRate: number;
  annualDebtService: number;
  dscr: number | null;
  yearlyProjections: YearlyProjection[];
  exitNoi: number;
  exitSalePrice: number;
  loanPayoffAtExit: number;
  netSaleProceeds: number;
  averageCashOnCashPct: number;
  unleveredIrrPct: number | null;
  leveredIrrPct: number | null;
  equityMultiple: number;
}

/** Standard amortizing-loan payment. Returns 0 for a zero/negative loan amount. */
function annualDebtService(loanAmount: number, annualRatePct: number, amortYears: number): number {
  if (loanAmount <= 0) return 0;
  if (annualRatePct <= 0) return amortYears > 0 ? loanAmount / amortYears : 0;
  if (amortYears <= 0) return loanAmount * (annualRatePct / 100); // interest-only

  const monthlyRate = annualRatePct / 100 / 12;
  const numPayments = amortYears * 12;
  const monthlyPayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments));
  return monthlyPayment * 12;
}

/** Remaining principal balance after `yearsElapsed` years of amortization. */
function remainingBalance(loanAmount: number, annualRatePct: number, amortYears: number, yearsElapsed: number): number {
  if (loanAmount <= 0) return 0;
  if (amortYears <= 0 || annualRatePct <= 0) return loanAmount; // interest-only: full principal still owed

  const monthlyRate = annualRatePct / 100 / 12;
  const totalPayments = amortYears * 12;
  const paymentsMade = Math.min(yearsElapsed * 12, totalPayments);
  if (paymentsMade >= totalPayments) return 0;

  const growth = Math.pow(1 + monthlyRate, totalPayments);
  const growthPaid = Math.pow(1 + monthlyRate, paymentsMade);
  return loanAmount * (growth - growthPaid) / (growth - 1);
}

// Reasonable starting assumptions for whatever a deal's extracted
// attributes don't already cover — an analyst overrides these in the tool,
// they're just a sane starting point rather than a blank form.
export const DEFAULT_UNDERWRITING_INPUTS: UnderwritingInputs = {
  purchasePrice: 0,
  closingCostsPct: 2,
  goingInNoi: 0,
  noiGrowthPct: 3,
  holdPeriodYears: 5,
  exitCapRate: 7,
  sellingCostsPct: 2,
  loanToValuePct: 65,
  interestRatePct: 6,
  amortizationYears: 30,
};

/** Pulls whatever underwriting-model inputs a deal's extracted attributes already answer, to pre-fill the tool. */
export function deriveInputsFromAttributes(
  attributes: { key: string; value: unknown }[]
): Partial<UnderwritingInputs> {
  const byKey = new Map(attributes.map((a) => [a.key, a.value]));
  const num = (key: string): number | undefined => {
    const v = byKey.get(key);
    return typeof v === "number" ? v : undefined;
  };

  const derived: Partial<UnderwritingInputs> = {};

  const purchasePrice = num("purchase_price");
  if (purchasePrice !== undefined) derived.purchasePrice = purchasePrice;

  const noi = num("noi") ?? num("t12_noi");
  if (noi !== undefined) derived.goingInNoi = noi;

  const holdPeriodYears = num("hold_period_years");
  if (holdPeriodYears !== undefined) derived.holdPeriodYears = holdPeriodYears;

  const exitCapRate = num("exit_cap_rate");
  if (exitCapRate !== undefined) derived.exitCapRate = exitCapRate;

  const loanAmount = num("loan_amount");
  const ltv = num("ltv") ?? (loanAmount !== undefined && purchasePrice ? (loanAmount / purchasePrice) * 100 : undefined);
  if (ltv !== undefined) derived.loanToValuePct = ltv;

  const interestRate = num("interest_rate");
  if (interestRate !== undefined) derived.interestRatePct = interestRate;

  const amortYears = num("amortization_years");
  if (amortYears !== undefined) derived.amortizationYears = amortYears;

  return derived;
}

/** IRR via bisection over [-99%, 1000%] annual rate. Returns null if cash flows never cross zero (no valid IRR). */
export function computeIrr(cashFlows: number[]): number | null {
  const npv = (rate: number) => cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);

  let low = -0.99;
  let high = 10;
  const npvLow = npv(low);
  const npvHigh = npv(high);
  if (npvLow === 0) return low * 100;
  if (npvHigh === 0) return high * 100;
  if ((npvLow > 0) === (npvHigh > 0)) return null; // no sign change — bisection can't isolate a root

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 1e-6) return mid * 100;
    if ((npvMid > 0) === (npvLow > 0)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return ((low + high) / 2) * 100;
}

export function runUnderwritingModel(inputs: UnderwritingInputs): UnderwritingResults {
  const {
    purchasePrice,
    closingCostsPct,
    goingInNoi,
    noiGrowthPct,
    holdPeriodYears,
    exitCapRate,
    sellingCostsPct,
    loanToValuePct,
    interestRatePct,
    amortizationYears,
  } = inputs;

  const totalProjectCost = purchasePrice * (1 + closingCostsPct / 100);
  const loanAmount = purchasePrice * (loanToValuePct / 100);
  const equityRequired = totalProjectCost - loanAmount;
  const goingInCapRate = purchasePrice > 0 ? (goingInNoi / purchasePrice) * 100 : 0;
  const debtService = annualDebtService(loanAmount, interestRatePct, amortizationYears);
  const dscr = debtService > 0 ? goingInNoi / debtService : null;

  const years = Math.max(1, Math.round(holdPeriodYears));
  const yearlyProjections: YearlyProjection[] = [];
  for (let year = 1; year <= years; year++) {
    const noi = goingInNoi * Math.pow(1 + noiGrowthPct / 100, year - 1);
    const cashFlowBeforeTax = noi - debtService;
    yearlyProjections.push({
      year,
      noi,
      debtService,
      cashFlowBeforeTax,
      cashOnCashPct: equityRequired > 0 ? (cashFlowBeforeTax / equityRequired) * 100 : 0,
    });
  }

  // Exit value uses forward (year N+1) NOI over the exit cap rate — the
  // standard convention, since a buyer at exit is pricing off the income
  // they're about to receive, not the income just earned.
  const exitNoi = goingInNoi * Math.pow(1 + noiGrowthPct / 100, years);
  const exitSalePrice = exitCapRate > 0 ? exitNoi / (exitCapRate / 100) : 0;
  const loanPayoffAtExit = remainingBalance(loanAmount, interestRatePct, amortizationYears, years);
  const netSaleProceeds = exitSalePrice * (1 - sellingCostsPct / 100) - loanPayoffAtExit;

  const averageCashOnCashPct =
    yearlyProjections.reduce((sum, y) => sum + y.cashOnCashPct, 0) / yearlyProjections.length;

  const unleveredCashFlows = [
    -totalProjectCost,
    ...yearlyProjections.map((y, i) => (i === yearlyProjections.length - 1 ? y.noi + exitSalePrice * (1 - sellingCostsPct / 100) : y.noi)),
  ];
  const unleveredIrrPct = computeIrr(unleveredCashFlows);

  const leveredCashFlows = [
    -equityRequired,
    ...yearlyProjections.map((y, i) =>
      i === yearlyProjections.length - 1 ? y.cashFlowBeforeTax + netSaleProceeds : y.cashFlowBeforeTax
    ),
  ];
  const leveredIrrPct = computeIrr(leveredCashFlows);

  const totalDistributions = yearlyProjections.reduce((sum, y) => sum + y.cashFlowBeforeTax, 0) + netSaleProceeds;
  const equityMultiple = equityRequired > 0 ? totalDistributions / equityRequired : 0;

  return {
    totalProjectCost,
    loanAmount,
    equityRequired,
    goingInCapRate,
    annualDebtService: debtService,
    dscr,
    yearlyProjections,
    exitNoi,
    exitSalePrice,
    loanPayoffAtExit,
    netSaleProceeds,
    averageCashOnCashPct,
    unleveredIrrPct,
    leveredIrrPct,
    equityMultiple,
  };
}
