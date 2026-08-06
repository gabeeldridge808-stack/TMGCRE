"use client";

import { useActionState, useState } from "react";
import { editDealAction, type EditDealState } from "./actions";
import { ASSET_CLASSES, STAGES, titleCase } from "@/lib/dealConstants";

const initialState: EditDealState = {};
const fieldStyle = { display: "block", width: "100%", padding: 8, marginTop: 4 } as const;

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
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <label>
        Name
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
      </label>
      <label>
        Asset Class
        <select
          name="asset_class"
          required
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value)}
          style={fieldStyle}
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
        <select name="stage" value={stage} onChange={(e) => setStage(e.target.value)} style={fieldStyle}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Owner
        <input name="owner" required value={owner} onChange={(e) => setOwner(e.target.value)} style={fieldStyle} />
      </label>

      {state.error && <p style={{ color: "#b00020", margin: 0 }}>{state.error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ padding: "10px 14px", cursor: "pointer" }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <a
          href={`/deals/${dealId}`}
          style={{ padding: "10px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "inherit" }}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
