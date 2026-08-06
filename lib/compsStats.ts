export interface CompSummaryInput {
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  cap_rate?: number | null;
}

export interface CompsSummary {
  count: number;
  avgPricePerSqft: number | null;
  avgPricePerUnit: number | null;
  avgCapRate: number | null;
}

function average(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeCompsSummary(comps: CompSummaryInput[]): CompsSummary {
  return {
    count: comps.length,
    avgPricePerSqft: average(comps.map((c) => c.price_per_sqft)),
    avgPricePerUnit: average(comps.map((c) => c.price_per_unit)),
    avgCapRate: average(comps.map((c) => c.cap_rate)),
  };
}
