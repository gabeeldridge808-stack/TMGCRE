"use client";

import { useActionState, useState } from "react";
import { createDealAction, type CreateDealState } from "./actions";
import { ASSET_CLASSES, STAGES, titleCase } from "@/lib/dealConstants";

const initialState: CreateDealState = {};
const fieldStyle = { display: "block", width: "100%", padding: 8, marginTop: 4 } as const;

export default function NewDealForm() {
  const [state, formAction, pending] = useActionState(createDealAction, initialState);

  // Controlled inputs — React resets uncontrolled fields after a form action
  // runs, which would otherwise wipe everything the user typed on a failed
  // submit (e.g. the DB being unreachable) instead of letting them retry.
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [stage, setStage] = useState<string>("sourcing");
  const [owner, setOwner] = useState("");

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
          <option value="" disabled>
            Select asset class…
          </option>
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

      <button type="submit" disabled={pending} style={{ padding: "10px 14px", cursor: "pointer" }}>
        {pending ? "Creating…" : "Create deal"}
      </button>
    </form>
  );
}
