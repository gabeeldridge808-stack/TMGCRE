"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { computeCompsSummary } from "@/lib/compsStats";

interface Comp {
  id: string;
  property_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  sale_date: string | null;
  sale_price: string | null;
  price_per_sqft: string | null;
  price_per_unit: string | null;
  cap_rate: string | null;
  building_sqft: string | null;
  unit_count: string | null;
}

function toNum(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function money(v: string | null): string {
  const n = toNum(v);
  return n === null ? "—" : `$${Math.round(n).toLocaleString()}`;
}

function pct(v: string | null): string {
  const n = toNum(v);
  return n === null ? "—" : `${n.toFixed(2)}%`;
}

function num(v: string | null): string {
  const n = toNum(v);
  return n === null ? "—" : n.toLocaleString();
}

export default function CompsTable({ dealId, comps }: { dealId: string; comps: Comp[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  if (comps.length === 0) {
    return <p className="text-muted">No comps imported yet.</p>;
  }

  const summary = computeCompsSummary(comps.map((c) => ({
    price_per_sqft: toNum(c.price_per_sqft),
    price_per_unit: toNum(c.price_per_unit),
    cap_rate: toNum(c.cap_rate),
  })));

  async function deleteComp(compId: string) {
    if (!window.confirm("Delete this comp?")) return;
    setPending(compId);
    const res = await fetch(`/api/deals/${dealId}/comps/${compId}`, { method: "DELETE" });
    setPending(null);
    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to delete comp.");
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="stat-tile">
          <div className="stat-label">Comps</div>
          <div className="stat-value">{summary.count}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Avg. Price/SF</div>
          <div className="stat-value">{summary.avgPricePerSqft ? `$${summary.avgPricePerSqft.toFixed(0)}` : "—"}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Avg. Price/Unit</div>
          <div className="stat-value">
            {summary.avgPricePerUnit ? `$${Math.round(summary.avgPricePerUnit).toLocaleString()}` : "—"}
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Avg. Cap Rate</div>
          <div className="stat-value">{summary.avgCapRate ? `${summary.avgCapRate.toFixed(2)}%` : "—"}</div>
        </div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Sale Date</th>
              <th style={{ textAlign: "right" }}>Sale Price</th>
              <th style={{ textAlign: "right" }}>$/SF</th>
              <th style={{ textAlign: "right" }}>$/Unit</th>
              <th style={{ textAlign: "right" }}>Cap Rate</th>
              <th style={{ textAlign: "right" }}>Building SF</th>
              <th style={{ textAlign: "right" }}>Units</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.property_name ?? "—"}</div>
                  <div className="text-faint">{[c.address, c.city, c.state].filter(Boolean).join(", ")}</div>
                </td>
                <td>{c.sale_date ?? "—"}</td>
                <td style={{ textAlign: "right" }}>{money(c.sale_price)}</td>
                <td style={{ textAlign: "right" }}>{money(c.price_per_sqft)}</td>
                <td style={{ textAlign: "right" }}>{money(c.price_per_unit)}</td>
                <td style={{ textAlign: "right" }}>{pct(c.cap_rate)}</td>
                <td style={{ textAlign: "right" }}>{num(c.building_sqft)}</td>
                <td style={{ textAlign: "right" }}>{num(c.unit_count)}</td>
                <td style={{ textAlign: "right" }}>
                  <button
                    onClick={() => deleteComp(c.id)}
                    disabled={pending === c.id}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
