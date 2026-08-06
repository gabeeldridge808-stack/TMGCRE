"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_UNDERWRITING_INPUTS,
  deriveInputsFromAttributes,
  runUnderwritingModel,
  type UnderwritingInputs,
} from "@/lib/underwritingModel";

interface FieldSpec {
  key: keyof UnderwritingInputs;
  label: string;
  suffix?: string;
  step?: number;
}

const INPUT_FIELDS: FieldSpec[] = [
  { key: "purchasePrice", label: "Purchase Price", suffix: "$" },
  { key: "closingCostsPct", label: "Closing Costs", suffix: "%", step: 0.5 },
  { key: "goingInNoi", label: "Going-In NOI (Year 1)", suffix: "$" },
  { key: "noiGrowthPct", label: "Annual NOI Growth", suffix: "%", step: 0.5 },
  { key: "holdPeriodYears", label: "Hold Period", suffix: "years" },
  { key: "exitCapRate", label: "Exit Cap Rate", suffix: "%", step: 0.25 },
  { key: "sellingCostsPct", label: "Selling Costs", suffix: "%", step: 0.5 },
  { key: "loanToValuePct", label: "Loan-to-Value", suffix: "%", step: 1 },
  { key: "interestRatePct", label: "Interest Rate", suffix: "%", step: 0.125 },
  { key: "amortizationYears", label: "Amortization, 0=IO", suffix: "years" },
];

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

export default function UnderwritingTool({ attributes }: { attributes: { key: string; value: unknown }[] }) {
  const [inputs, setInputs] = useState<UnderwritingInputs>(() => ({
    ...DEFAULT_UNDERWRITING_INPUTS,
    ...deriveInputsFromAttributes(attributes),
  }));

  const results = useMemo(() => runUnderwritingModel(inputs), [inputs]);

  function setField(key: keyof UnderwritingInputs, raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(value)) return;
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
        A quick single-scenario pro forma — constant NOI growth, one loan, a cap-rate exit. Not a substitute for a
        full model, but enough to sanity-check whether a deal is worth taking further. Fields are pre-filled from
        this deal&rsquo;s extracted attributes where available; edit anything to test a different scenario.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Assumptions</h3>
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
        <ResultTile label="Going-In Cap Rate" value={pct(results.goingInCapRate)} />
        <ResultTile label="Total Equity Required" value={money(results.equityRequired)} />
        <ResultTile label="Loan Amount" value={money(results.loanAmount)} />
        <ResultTile label="Annual Debt Service" value={money(results.annualDebtService)} />
        <ResultTile
          label="Year 1 DSCR"
          value={results.dscr === null ? "—" : `${results.dscr.toFixed(2)}x`}
          flag={results.dscr !== null && results.dscr < 1.2}
        />
        <ResultTile label="Avg. Cash-on-Cash" value={pct(results.averageCashOnCashPct)} />
        <ResultTile label="Unlevered IRR" value={pct(results.unleveredIrrPct)} />
        <ResultTile label="Levered IRR" value={pct(results.leveredIrrPct)} highlight />
        <ResultTile label="Equity Multiple" value={`${results.equityMultiple.toFixed(2)}x`} highlight />
        <ResultTile label="Projected Exit Sale Price" value={money(results.exitSalePrice)} />
        <ResultTile label="Net Sale Proceeds" value={money(results.netSaleProceeds)} />
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h3>Year-by-Year Projection</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Year</th>
              <th style={{ textAlign: "right" }}>NOI</th>
              <th style={{ textAlign: "right" }}>Debt Service</th>
              <th style={{ textAlign: "right" }}>Cash Flow</th>
              <th style={{ textAlign: "right" }}>Cash-on-Cash</th>
            </tr>
          </thead>
          <tbody>
            {results.yearlyProjections.map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td style={{ textAlign: "right" }}>{money(y.noi)}</td>
                <td style={{ textAlign: "right" }}>{money(y.debtService)}</td>
                <td style={{ textAlign: "right" }}>{money(y.cashFlowBeforeTax)}</td>
                <td style={{ textAlign: "right" }}>{pct(y.cashOnCashPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
