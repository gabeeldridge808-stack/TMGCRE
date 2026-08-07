"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_CONDO_UNDERWRITING_INPUTS,
  deriveCondoInputsFromAttributes,
  runCondoUnderwritingModel,
  type CondoUnderwritingInputs,
} from "@/lib/condoUnderwritingModel";

interface FieldSpec {
  key: keyof CondoUnderwritingInputs;
  label: string;
  suffix?: string;
  step?: number;
}

const INPUT_FIELDS: FieldSpec[] = [
  { key: "landCost", label: "Land Cost", suffix: "$" },
  { key: "hardCosts", label: "Hard Costs", suffix: "$" },
  { key: "softCosts", label: "Soft Costs", suffix: "$" },
  { key: "contingencyPct", label: "Contingency", suffix: "%", step: 0.5 },
  { key: "developerFeePct", label: "Developer Fee", suffix: "%", step: 0.5 },
  { key: "loanToCostPct", label: "Loan-to-Cost", suffix: "%", step: 1 },
  { key: "constructionInterestRatePct", label: "Construction Interest Rate", suffix: "%", step: 0.125 },
  { key: "constructionDurationMonths", label: "Construction Duration", suffix: "months" },
  { key: "salesPeriodMonths", label: "Sales Period", suffix: "months" },
  { key: "totalUnits", label: "Total Units", suffix: "units" },
  { key: "avgPricePerUnit", label: "Avg Price per Unit", suffix: "$" },
  { key: "salesCommissionPct", label: "Sales Commission", suffix: "%", step: 0.5 },
];

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

export default function CondoUnderwritingTool({ attributes }: { attributes: { key: string; value: unknown }[] }) {
  const [inputs, setInputs] = useState<CondoUnderwritingInputs>(() => ({
    ...DEFAULT_CONDO_UNDERWRITING_INPUTS,
    ...deriveCondoInputsFromAttributes(attributes),
  }));

  const results = useMemo(() => runCondoUnderwritingModel(inputs), [inputs]);

  function setField(key: keyof CondoUnderwritingInputs, raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(value)) return;
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
        A high-level development pro forma for a for-sale build — land + hard/soft costs financed by a
        construction loan, resolved by selling units rather than held for income. No cap rate or NOI here; this
        is a build-and-sell math, not a hold-for-cash-flow model. Fields are pre-filled from this deal&rsquo;s
        extracted attributes where available; edit anything to test a different scenario.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Development Assumptions</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {INPUT_FIELDS.map((field) => (
            <label key={field.key}>
              {field.label} {field.suffix && <span className="text-faint">({field.suffix})</span>}
              <input
                className="field"
                type="number"
                step={field.step ?? "any"}
                value={inputs[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                style={{ marginTop: 4 }}
              />
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, marginBottom: 24 }}>
        <ResultTile label="Total Development Cost" value={money(results.totalDevelopmentCost)} />
        <ResultTile label="Construction Loan" value={money(results.constructionLoanAmount)} />
        <ResultTile label="Equity Required" value={money(results.equityRequired)} />
        <ResultTile label="Est. Construction Interest" value={money(results.estimatedConstructionLoanInterest)} />
        <ResultTile label="Total Project Cost" value={money(results.totalProjectCost)} />
        <ResultTile label="Gross Sellout" value={money(results.grossSellout)} />
        <ResultTile label="Net Sales Revenue" value={money(results.netSalesRevenue)} />
        <ResultTile label="Net Profit" value={money(results.netProfit)} highlight flag={results.netProfit < 0} />
        <ResultTile label="Profit Margin (on Cost)" value={pct(results.profitMarginOnCostPct)} highlight />
        <ResultTile label="Profit Margin (on Revenue)" value={pct(results.profitMarginOnRevenuePct)} />
        <ResultTile label="Equity Multiple" value={`${results.equityMultiple.toFixed(2)}x`} highlight />
        <ResultTile label="Annualized Project IRR" value={pct(results.projectIrrPct)} highlight />
      </div>

      <p className="text-faint">
        Total project duration: {results.totalProjectDurationMonths} months (construction + sales period).
        Construction interest is estimated at half the loan balance across that full timeline — a standard
        back-of-envelope approximation, not a month-by-month draw schedule.
      </p>
    </div>
  );
}

function ResultTile({
  label,
  value,
  flag,
  highlight,
}: {
  label: string;
  value: string;
  flag?: boolean;
  highlight?: boolean;
}) {
  const className = flag ? "stat-tile stat-tile-flag" : highlight ? "stat-tile stat-tile-highlight" : "stat-tile";
  return (
    <div className={className}>
      <div className="stat-label">{label}</div>
      <div className={flag ? "stat-value stat-value-flag" : "stat-value"}>{value}</div>
    </div>
  );
}
