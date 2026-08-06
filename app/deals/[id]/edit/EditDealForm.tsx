"use client";

import { useActionState, useState } from "react";
import { editDealAction, type EditDealState } from "./actions";
import { ASSET_CLASSES, STAGES, titleCase } from "@/lib/dealConstants";

const initialState: EditDealState = {};

export default function EditDealForm({
  dealId,
  initial,
}: {
  dealId: string;
  initial: { name: string; asset_class: string; stage: string; owner: string };
}) {
  const boundAction = editDealAction.bind(null, dealId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const [name, setName] = useState(initial.name);
  const [assetClass, setAssetClass] = useState(initial.asset_class);
  const [stage, setStage] = useState(initial.stage);
  const [owner, setOwner] = useState(initial.owner);

  return (
    <form action={formAction} className="card" style={{ display: "grid", gap: 16 }}>
      <label>
        Name
        <input
          className="field"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginTop: 4 }}
        />
      </label>
      <label>
        Asset Class
        <select
          className="field"
          name="asset_class"
          required
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value)}
          style={{ marginTop: 4 }}
        >
          {ASSET_CLASSES.map((ac) => (
            <option key={ac} value={ac}>
              {titleCase(ac)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Stage
        <select
          className="field"
          name="stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          style={{ marginTop: 4 }}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Owner
        <input
          className="field"
          name="owner"
          required
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          style={{ marginTop: 4 }}
        />
      </label>

      {state.error && <p className="text-danger" style={{ margin: 0, fontSize: 14 }}>{state.error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <a href={`/deals/${dealId}`} className="btn btn-secondary">
          Cancel
        </a>
      </div>
    </form>
  );
}
