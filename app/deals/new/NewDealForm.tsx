"use client";

import { useActionState, useState } from "react";
import { createDealAction, type CreateDealState } from "./actions";

const initialState: CreateDealState = {};
const fieldStyle = { display: "block", width: "100%", padding: 8, marginTop: 4 } as const;

export default function NewDealForm() {
  const [state, formAction, pending] = useActionState(createDealAction, initialState);

  // Controlled inputs — React resets uncontrolled fields after a form action
  // runs, which would otherwise wipe everything the user typed on a failed
  // submit (e.g. the DB being unreachable) instead of letting them retry.
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");

  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <label>
        Name
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
      </label>
      <label>
        Asset Class
        <input
          name="asset_class"
          required
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value)}
          style={fieldStyle}
        />
      </label>
      <label>
        Stage
        <input
          name="stage"
          placeholder="sourcing"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          style={fieldStyle}
        />
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
