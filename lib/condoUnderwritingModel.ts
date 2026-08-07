// High-level underwriting model for a for-sale condo development —
// deliberately NOT built on lib/underwritingModel.ts's income-property
// math (no NOI, no cap rate, no hold period: there's no in-place income to
// underwrite). This is a development pro forma: land + hard/soft costs
// financed by a construction loan, resolved by selling units rather than
// holding for cash flow. Same philosophy as the income model though — a
// quick single-scenario calculator an analyst runs before a full
// multi-tab Excel model, not a substitute for one.
export interface CondoUnderwritingInputs {
  landCost: number;
  hardCosts: number;
  softCosts: number;
  contingencyPct: number;
  developerFeePct: number;
  loanToCostPct: number;
  constructionInterestRatePct: number;
  constructionDurationMonths: number;
  salesPeriodMonths: number;
  totalUnits: number;
  avgPricePerUnit: number;
  salesCommissionPct: number;
}

export const DEFAULT_CONDO_UNDERWRITING_INPUTS: CondoUnderwritingInputs = {
  landCost: 0,
  hardCosts: 0,
  softCosts: 0,
  contingencyPct: 5,
  developerFeePct: 4,
  loanToCostPct: 65,
  constructionInterestRatePct: 9,
  constructionDurationMonths: 24,
  salesPeriodMonths: 12,
  totalUnits: 0,
  avgPricePerUnit: 0,
  salesCommissionPct: 5,
};

export interface CondoUnderwritingResults {
  contingencyAmount: number;
  developerFeeAmount: number;
  totalDevelopmentCost: number;
  constructionLoanAmount: number;
  equityRequired: number;
  estimatedConstructionLoanInterest: number;
  totalProjectCost: number;
  grossSellout: number;
  salesCommissionAmount: number;
  netSalesRevenue: number;
  netProfit: number;
  profitMarginOnCostPct: number;
  profitMarginOnRevenuePct: number;
  equityMultiple: number;
  /** Null when the project loses enough money that annualizing a negative multiple isn't a meaningful rate. */
  projectIrrPct: number | null;
  totalProjectDurationMonths: number;
}

export function runCondoUnderwritingModel(inputs: CondoUnderwritingInputs): CondoUnderwritingResults {
  const {
    landCost,
    hardCosts,
    softCosts,
    contingencyPct,
    developerFeePct,
    loanToCostPct,
    constructionInterestRatePct,
    constructionDurationMonths,
    salesPeriodMonths,
    totalUnits,
    avgPricePerUnit,
    salesCommissionPct,
  } = inputs;

  const contingencyAmount = (hardCosts + softCosts) * (contingencyPct / 100);
  const subtotalBeforeFee = landCost + hardCosts + softCosts + contingencyAmount;
  const developerFeeAmount = subtotalBeforeFee * (developerFeePct / 100);
  const totalDevelopmentCost = subtotalBeforeFee + developerFeeAmount;

  const constructionLoanAmount = totalDevelopmentCost * (loanToCostPct / 100);
  const equityRequired = totalDevelopmentCost - constructionLoanAmount;

  // Construction loans draw incrementally (low balance early, peaking at
  // completion) then pay down as units close during the sales period —
  // roughly a triangular balance profile. Averaging the balance at half
  // the loan amount across the full construction-plus-sellout timeline is
  // a standard back-of-envelope approximation for interest carry, not a
  // month-by-month draw schedule.
  const totalProjectDurationMonths = constructionDurationMonths + salesPeriodMonths;
  const estimatedConstructionLoanInterest =
    constructionLoanAmount * (constructionInterestRatePct / 100) * 0.5 * (totalProjectDurationMonths / 12);

  const totalProjectCost = totalDevelopmentCost + estimatedConstructionLoanInterest;

  const grossSellout = totalUnits * avgPricePerUnit;
  const salesCommissionAmount = grossSellout * (salesCommissionPct / 100);
  const netSalesRevenue = grossSellout - salesCommissionAmount;
  const netProfit = netSalesRevenue - totalProjectCost;

  const profitMarginOnCostPct = totalProjectCost > 0 ? (netProfit / totalProjectCost) * 100 : 0;
  const profitMarginOnRevenuePct = grossSellout > 0 ? (netProfit / grossSellout) * 100 : 0;
  const equityMultiple = equityRequired > 0 ? (equityRequired + netProfit) / equityRequired : 0;

  let projectIrrPct: number | null = null;
  if (equityRequired > 0 && totalProjectDurationMonths > 0) {
    const totalReturnMultiple = (equityRequired + netProfit) / equityRequired;
    if (totalReturnMultiple > 0) {
      projectIrrPct = (Math.pow(totalReturnMultiple, 12 / totalProjectDurationMonths) - 1) * 100;
    }
  }

  return {
    contingencyAmount,
    developerFeeAmount,
    totalDevelopmentCost,
    constructionLoanAmount,
    equityRequired,
    estimatedConstructionLoanInterest,
    totalProjectCost,
    grossSellout,
    salesCommissionAmount,
    netSalesRevenue,
    netProfit,
    profitMarginOnCostPct,
    profitMarginOnRevenuePct,
    equityMultiple,
    projectIrrPct,
    totalProjectDurationMonths,
  };
}

/** Pulls whatever condo-underwriting inputs a deal's extracted attributes already answer, to pre-fill the tool. */
export function deriveCondoInputsFromAttributes(
  attributes: { key: string; value: unknown }[]
): Partial<CondoUnderwritingInputs> {
  const byKey = new Map(attributes.map((a) => [a.key, a.value]));
  const num = (key: string): number | undefined => {
    const v = byKey.get(key);
    return typeof v === "number" ? v : undefined;
  };

  const derived: Partial<CondoUnderwritingInputs> = {};

  const landCost = num("purchase_price");
  if (landCost !== undefined) derived.landCost = landCost;

  const hardCosts = num("hard_costs");
  if (hardCosts !== undefined) derived.hardCosts = hardCosts;

  const softCosts = num("soft_costs");
  if (softCosts !== undefined) derived.softCosts = softCosts;

  const contingencyPct = num("contingency_pct");
  if (contingencyPct !== undefined) derived.contingencyPct = contingencyPct;

  const developerFeePct = num("developer_fee_pct");
  if (developerFeePct !== undefined) derived.developerFeePct = developerFeePct;

  const loanToCostPct = num("loan_to_cost_pct");
  if (loanToCostPct !== undefined) derived.loanToCostPct = loanToCostPct;

  const constructionInterestRatePct = num("construction_interest_rate");
  if (constructionInterestRatePct !== undefined) derived.constructionInterestRatePct = constructionInterestRatePct;

  const constructionDurationMonths = num("construction_duration_months");
  if (constructionDurationMonths !== undefined) derived.constructionDurationMonths = constructionDurationMonths;

  const salesPeriodMonths = num("sales_period_months");
  if (salesPeriodMonths !== undefined) derived.salesPeriodMonths = salesPeriodMonths;

  const totalUnits = num("total_units");
  if (totalUnits !== undefined) derived.totalUnits = totalUnits;

  const avgPricePerUnit = num("avg_price_per_unit");
  if (avgPricePerUnit !== undefined) derived.avgPricePerUnit = avgPricePerUnit;

  const salesCommissionPct = num("sales_commission_pct");
  if (salesCommissionPct !== undefined) derived.salesCommissionPct = salesCommissionPct;

  return derived;
}
