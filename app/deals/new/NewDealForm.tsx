"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDealAction, type CreateDealState } from "./actions";
import { ASSET_CLASSES, STAGES, titleCase } from "@/lib/dealConstants";

const initialState: CreateDealState = {};

export default function NewDealForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createDealAction, initialState);

  useEffect(() => {
    if (state.dealId) router.push(`/deals/${state.dealId}`);
  }, [state.dealId, router]);

  // Controlled inputs — React resets uncontrolled fields after a form action
  // runs, which would otherwise wipe everything the user typed on a failed
  // submit (e.g. the DB being unreachable) instead of letting them retry.
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [stage, setStage] = useState<string>("sourcing");
  const [owner, setOwner] = useState("");

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

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creating…" : "Create deal"}
      </button>
    </form>
  );
}
