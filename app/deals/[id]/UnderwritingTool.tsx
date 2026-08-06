"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_UNDERWRITING_INPUTS,
  deriveInputsFromAttributes,
  runUnderwritingModel,
  type UnderwritingInputs,
} from "@/lib/underwritingModel";

const fieldStyle = { display: "block", width: "100%", padding: 8, marginTop: 4 } as const;

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
  { key: "amortizationYears", label: "Amortization (0 = interest-only)", suffix: "years" },
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
      <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
        A quick single-scenario pro forma — constant NOI growth, one loan, a cap-rate exit. Not a substitute for a
        full model, but enough to sanity-check whether a deal is worth taking further. Fields are pre-filled from
        this deal&rsquo;s extracted attributes where available; edit anything to test a different scenario.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {INPUT_FIELDS.map((field) => (
          <label key={field.key}>
            {field.label} {field.suffix && <span style={{ color: "#999" }}>({field.suffix})</span>}
            <input
              type="number"
              step={field.step ?? "any"}
              value={inputs[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              style={fieldStyle}
            />
          </label>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        <ResultTile label="Going-In Cap Rate" value={pct(results.goingInCapRate)} />
        <ResultTile label="Total Equity Required" value={money(results.equityRequired)} />
        <ResultTile label="Loan Amount" value={money(results.loanAmount)} />
        <ResultTile label="Annual Debt Service" value={money(results.annualDebtService)} />
        <ResultTile label="Year 1 DSCR" value={results.dscr === null ? "—" : `${results.dscr.toFixed(2)}x`} flag={results.dscr !== null && results.dscr < 1.2} />
        <ResultTile label="Avg. Cash-on-Cash" value={pct(results.averageCashOnCashPct)} />
        <ResultTile label="Unlevered IRR" value={pct(results.unleveredIrrPct)} />
        <ResultTile label="Levered IRR" value={pct(results.leveredIrrPct)} highlight />
        <ResultTile label="Equity Multiple" value={`${results.equityMultiple.toFixed(2)}x`} highlight />
        <ResultTile label="Projected Exit Sale Price" value={money(results.exitSalePrice)} />
        <ResultTile label="Net Sale Proceeds" value={money(results.netSaleProceeds)} />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Year</th>
            <th style={{ padding: "6px 8px" }}>NOI</th>
            <th style={{ padding: "6px 8px" }}>Debt Service</th>
            <th style={{ padding: "6px 8px" }}>Cash Flow</th>
            <th style={{ padding: "6px 8px" }}>Cash-on-Cash</th>
          </tr>
        </thead>
        <tbody>
          {results.yearlyProjections.map((y) => (
            <tr key={y.year} style={{ borderBottom: "1px solid #eee", textAlign: "right" }}>
              <td style={{ textAlign: "left", padding: "6px 8px" }}>{y.year}</td>
              <td style={{ padding: "6px 8px" }}>{money(y.noi)}</td>
              <td style={{ padding: "6px 8px" }}>{money(y.debtService)}</td>
              <td style={{ padding: "6px 8px" }}>{money(y.cashFlowBeforeTax)}</td>
              <td style={{ padding: "6px 8px" }}>{pct(y.cashOnCashPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  return (
    <div
      style={{
        padding: 12,
        border: `1px solid ${flag ? "#e0a030" : "#ddd"}`,
        borderRadius: 8,
        background: highlight ? "#f7f9fc" : undefined,
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: flag ? "#b06000" : undefined }}>{value}</div>
    </div>
  );
}
