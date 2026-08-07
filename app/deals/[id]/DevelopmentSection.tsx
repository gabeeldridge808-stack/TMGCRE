"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEVELOPMENT_STAGE_LABELS, DEVELOPMENT_STAGE_BADGE_VARIANT, type DevelopmentStage } from "@/lib/dealConstants";
import Badge from "@/app/Badge";

type FieldType = "text" | "number" | "date" | "boolean" | "select";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

const CORE_FIELDS: FieldDef[] = [
  { key: "site_control_structure", label: "Site Control Structure", type: "select", options: ["owned", "option", "jv", "ground_lease"] },
  { key: "entitlement_jurisdiction", label: "Entitlement Jurisdiction", type: "text" },
  { key: "entitlement_status", label: "Entitlement Status", type: "text" },
  { key: "equity_amount", label: "Equity Amount", type: "number" },
  { key: "senior_debt_amount", label: "Senior Debt Amount", type: "number" },
  { key: "mezz_pref_amount", label: "Mezz / Pref Amount", type: "number" },
  { key: "jv_structure", label: "JV Structure", type: "text" },
  { key: "acquisition_closing_date", label: "Acquisition / Closing Date", type: "date" },
  { key: "permit_submittal_date", label: "Permit Submittal Date", type: "date" },
  { key: "gc_mobilization_date", label: "GC Mobilization Date", type: "date" },
  { key: "projected_delivery_date", label: "Projected Delivery Date", type: "date" },
  { key: "projected_stabilization_date", label: "Projected Stabilization Date", type: "date" },
  { key: "land_basis", label: "Land Basis", type: "number" },
  { key: "hard_costs_budget", label: "Hard Costs Budget", type: "number" },
  { key: "soft_costs_budget", label: "Soft Costs Budget", type: "number" },
  { key: "contingency_budget", label: "Contingency Budget", type: "number" },
  { key: "total_cost_basis", label: "Total Cost Basis", type: "number" },
  { key: "total_cost_actual", label: "Total Cost Actual (running)", type: "number" },
  { key: "entitlement_risk", label: "Entitlement Risk", type: "select", options: ["low", "medium", "high"] },
  { key: "cost_overrun_risk", label: "Cost Overrun Risk", type: "select", options: ["low", "medium", "high"] },
  { key: "market_risk", label: "Market Risk", type: "select", options: ["low", "medium", "high"] },
];

const ASSET_DETAIL_FIELDS: Record<string, FieldDef[]> = {
  industrial: [
    { key: "building_sf", label: "Building SF", type: "number" },
    { key: "clear_height_ft", label: "Clear Height (ft)", type: "number" },
    { key: "dock_doors", label: "Dock Doors", type: "number" },
    { key: "trailer_stalls", label: "Trailer Stalls", type: "number" },
    { key: "office_sf", label: "Office SF", type: "number" },
    { key: "truck_court_depth_ft", label: "Truck Court Depth (ft)", type: "number" },
    { key: "delivery_type", label: "Delivery Type", type: "select", options: ["spec", "build_to_suit"] },
    { key: "bts_tenant_name", label: "BTS Tenant Name", type: "text" },
    { key: "bts_tenant_lease_status", label: "BTS Tenant Lease Status", type: "text" },
    { key: "bts_lease_term_months", label: "BTS Lease Term (months)", type: "number" },
    { key: "target_tenant_profile", label: "Target Tenant Profile", type: "text" },
    { key: "leasing_broker", label: "Leasing Broker", type: "text" },
    { key: "ios_yard_acreage", label: "IOS Yard Acreage", type: "number" },
    { key: "ios_yard_stall_count", label: "IOS Yard Stall Count", type: "number" },
    { key: "ios_yard_projected_income", label: "IOS Yard Projected Income", type: "number" },
  ],
  hospitality: [
    { key: "room_count", label: "Room Count", type: "number" },
    { key: "brand", label: "Brand", type: "text" },
    { key: "is_independent", label: "Independent (no brand)", type: "boolean" },
    { key: "management_company", label: "Management Company", type: "text" },
    { key: "franchise_agreement_status", label: "Franchise Agreement Status", type: "text" },
    { key: "franchise_agreement_term_years", label: "Franchise Term (years)", type: "number" },
    { key: "fb_amenity_program", label: "F&B / Amenity Program", type: "text" },
    { key: "projected_adr", label: "Projected ADR", type: "number" },
    { key: "projected_occupancy_pct", label: "Projected Occupancy %", type: "number" },
    { key: "projected_revpar", label: "Projected RevPAR", type: "number" },
    { key: "pip_cost", label: "PIP Cost", type: "number" },
    { key: "is_conversion", label: "Conversion / Renovation", type: "boolean" },
  ],
  condo: [
    { key: "hoa_structure", label: "HOA Structure", type: "text" },
    { key: "deposit_escrow_terms", label: "Deposit / Escrow Terms", type: "text" },
    { key: "construction_lender_presale_threshold_pct", label: "Construction Lender Presale Threshold %", type: "number" },
  ],
  retail: [
    { key: "building_sf", label: "Building SF", type: "number" },
    { key: "pad_count", label: "Pad Count", type: "number" },
    { key: "tenant_name", label: "Tenant Name", type: "text" },
    { key: "tenant_status", label: "Tenant Status", type: "select", options: ["vacant_spec", "loi", "lease_executed"] },
    { key: "lease_term_months", label: "Lease Term (months)", type: "number" },
    { key: "drive_thru", label: "Drive-Thru", type: "boolean" },
    { key: "parking_stalls_required", label: "Parking Stalls Required", type: "number" },
    { key: "parking_stalls_provided", label: "Parking Stalls Provided", type: "number" },
  ],
};

type FieldValues = Record<string, string | number | boolean | null>;

function Field({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: string | number | boolean | null) => void }) {
  if (def.type === "boolean") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {def.label}
      </label>
    );
  }

  if (def.type === "select") {
    return (
      <label style={{ fontSize: 13 }}>
        {def.label}
        <select
          className="field"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ marginTop: 4 }}
        >
          <option value="">—</option>
          {def.options?.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label style={{ fontSize: 13 }}>
      {def.label}
      <input
        className="field"
        type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(def.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null)}
        style={{ marginTop: 4 }}
      />
    </label>
  );
}

function valuesFromRow(fields: FieldDef[], row: Record<string, unknown> | null): FieldValues {
  const out: FieldValues = {};
  for (const f of fields) {
    const v = row?.[f.key];
    out[f.key] = (v as string | number | boolean | null) ?? null;
  }
  return out;
}

interface Milestone {
  id: string;
  category: "entitlement_approval" | "budget_change" | "schedule_change" | "other";
  label: string;
  milestone_date: string | null;
  target_date: string | null;
  status: "pending" | "complete" | "delayed" | "at_risk";
  notes: string | null;
}

const MILESTONE_STATUS_VARIANT: Record<Milestone["status"], "neutral" | "info" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  complete: "success",
  delayed: "warning",
  at_risk: "danger",
};

interface CondoUnitSalesSnapshot {
  id: string;
  as_of_date: string;
  units_released: number;
  units_under_contract: number;
  units_closed: number;
}

export default function DevelopmentSection({
  dealId,
  assetClass,
  developmentStage,
  initialDetails,
  initialAssetClassDetails,
  initialMilestones,
  initialUnitSales,
}: {
  dealId: string;
  assetClass: string;
  developmentStage: string | null;
  initialDetails: Record<string, unknown> | null;
  initialAssetClassDetails: Record<string, unknown> | null;
  initialMilestones: Milestone[];
  initialUnitSales: CondoUnitSalesSnapshot[];
}) {
  const router = useRouter();
  const assetFields = ASSET_DETAIL_FIELDS[assetClass] ?? [];

  const [core, setCore] = useState<FieldValues>(valuesFromRow(CORE_FIELDS, initialDetails));
  const [assetDetails, setAssetDetails] = useState<FieldValues>(valuesFromRow(assetFields, initialAssetClassDetails));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function saveDetails() {
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/deals/${dealId}/development`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ core, assetDetails }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? "Failed to save development details.");
    }
  }

  const [milestones, setMilestones] = useState(initialMilestones);
  const [newMilestone, setNewMilestone] = useState({ category: "entitlement_approval", label: "", target_date: "" });
  const [addingMilestone, setAddingMilestone] = useState(false);

  async function addMilestone() {
    if (!newMilestone.label.trim()) return;
    setAddingMilestone(true);
    const res = await fetch(`/api/deals/${dealId}/milestones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: newMilestone.category, label: newMilestone.label, target_date: newMilestone.target_date || undefined }),
    });
    setAddingMilestone(false);
    if (res.ok) {
      const created = await res.json();
      setMilestones((prev) => [...prev, created]);
      setNewMilestone({ category: "entitlement_approval", label: "", target_date: "" });
    } else {
      alert("Failed to add milestone.");
    }
  }

  async function markMilestoneComplete(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/deals/${dealId}/milestones/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "complete", milestone_date: today }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMilestones((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } else {
      alert("Failed to update milestone.");
    }
  }

  const [unitSales, setUnitSales] = useState(initialUnitSales);
  const [newSnapshot, setNewSnapshot] = useState({ as_of_date: "", units_released: "", units_under_contract: "", units_closed: "" });
  const [addingSnapshot, setAddingSnapshot] = useState(false);

  async function addSnapshot() {
    if (!newSnapshot.as_of_date) return;
    setAddingSnapshot(true);
    const res = await fetch(`/api/deals/${dealId}/condo-unit-sales`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        as_of_date: newSnapshot.as_of_date,
        units_released: Number(newSnapshot.units_released || 0),
        units_under_contract: Number(newSnapshot.units_under_contract || 0),
        units_closed: Number(newSnapshot.units_closed || 0),
      }),
    });
    setAddingSnapshot(false);
    if (res.ok) {
      const created = await res.json();
      setUnitSales((prev) => [...prev, created]);
      setNewSnapshot({ as_of_date: "", units_released: "", units_under_contract: "", units_closed: "" });
    } else {
      alert("Failed to log unit-sales snapshot.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Development</h2>
        {developmentStage && (
          <Badge variant={DEVELOPMENT_STAGE_BADGE_VARIANT[developmentStage as DevelopmentStage]}>
            {DEVELOPMENT_STAGE_LABELS[developmentStage as DevelopmentStage]}
          </Badge>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Core Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {CORE_FIELDS.map((f) => (
            <Field key={f.key} def={f} value={core[f.key]} onChange={(v) => setCore((prev) => ({ ...prev, [f.key]: v }))} />
          ))}
        </div>

        {assetFields.length > 0 && (
          <>
            <h3 style={{ marginTop: 24 }}>{assetClass[0].toUpperCase() + assetClass.slice(1)}-Specific Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {assetFields.map((f) => (
                <Field key={f.key} def={f} value={assetDetails[f.key]} onChange={(v) => setAssetDetails((prev) => ({ ...prev, [f.key]: v }))} />
              ))}
            </div>
          </>
        )}

        {saveError && (
          <p className="text-danger" style={{ marginTop: 12 }}>
            {saveError}
          </p>
        )}
        <button onClick={saveDetails} disabled={saving} className="btn btn-primary" style={{ marginTop: 16 }}>
          {saving ? "Saving…" : "Save Development Details"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Milestones</h3>
        {milestones.length === 0 ? (
          <p className="text-muted" style={{ marginTop: -8 }}>
            No milestones logged yet.
          </p>
        ) : (
          <table className="table" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Label</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr key={m.id}>
                  <td className="text-muted">{m.category.replace(/_/g, " ")}</td>
                  <td>{m.label}</td>
                  <td>{m.target_date ?? "—"}</td>
                  <td>{m.milestone_date ?? "—"}</td>
                  <td>
                    <Badge variant={MILESTONE_STATUS_VARIANT[m.status]}>{m.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {m.status !== "complete" && (
                      <button onClick={() => markMilestoneComplete(m.id)} className="btn btn-secondary btn-sm">
                        Mark complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13 }}>
            Category
            <select
              className="field"
              value={newMilestone.category}
              onChange={(e) => setNewMilestone((prev) => ({ ...prev, category: e.target.value }))}
              style={{ marginTop: 4 }}
            >
              <option value="entitlement_approval">Entitlement approval</option>
              <option value="budget_change">Budget change</option>
              <option value="schedule_change">Schedule change</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label style={{ fontSize: 13, flex: "1 1 200px" }}>
            Label
            <input
              className="field"
              value={newMilestone.label}
              onChange={(e) => setNewMilestone((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="e.g. Planning Commission approval"
              style={{ marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            Target Date
            <input
              className="field"
              type="date"
              value={newMilestone.target_date}
              onChange={(e) => setNewMilestone((prev) => ({ ...prev, target_date: e.target.value }))}
              style={{ marginTop: 4 }}
            />
          </label>
          <button onClick={addMilestone} disabled={addingMilestone || !newMilestone.label.trim()} className="btn btn-secondary">
            Add
          </button>
        </div>
      </div>

      {assetClass === "condo" && (
        <div className="card">
          <h3>Unit Sales Pace</h3>
          {unitSales.length === 0 ? (
            <p className="text-muted" style={{ marginTop: -8 }}>
              No sales snapshots logged yet.
            </p>
          ) : (
            <table className="table" style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>As Of</th>
                  <th>Released</th>
                  <th>Under Contract</th>
                  <th>Closed</th>
                </tr>
              </thead>
              <tbody>
                {unitSales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.as_of_date}</td>
                    <td>{s.units_released}</td>
                    <td>{s.units_under_contract}</td>
                    <td>{s.units_closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ fontSize: 13 }}>
              As Of
              <input
                className="field"
                type="date"
                value={newSnapshot.as_of_date}
                onChange={(e) => setNewSnapshot((prev) => ({ ...prev, as_of_date: e.target.value }))}
                style={{ marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Released
              <input
                className="field"
                type="number"
                value={newSnapshot.units_released}
                onChange={(e) => setNewSnapshot((prev) => ({ ...prev, units_released: e.target.value }))}
                style={{ marginTop: 4, width: 100 }}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Under Contract
              <input
                className="field"
                type="number"
                value={newSnapshot.units_under_contract}
                onChange={(e) => setNewSnapshot((prev) => ({ ...prev, units_under_contract: e.target.value }))}
                style={{ marginTop: 4, width: 100 }}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Closed
              <input
                className="field"
                type="number"
                value={newSnapshot.units_closed}
                onChange={(e) => setNewSnapshot((prev) => ({ ...prev, units_closed: e.target.value }))}
                style={{ marginTop: 4, width: 100 }}
              />
            </label>
            <button onClick={addSnapshot} disabled={addingSnapshot || !newSnapshot.as_of_date} className="btn btn-secondary">
              Log Snapshot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
