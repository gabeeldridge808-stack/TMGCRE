"use client";

import { useActionState } from "react";
import { createUserAction, type CreateUserState } from "./actions";

const initialState: CreateUserState = {};

export default function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <form
      action={formAction}
      className="card"
      style={{ display: "grid", gap: 16 }}
      key={state.success ? "reset" : "form"}
    >
      <label>
        Name
        <input className="field" name="name" required style={{ marginTop: 4 }} />
      </label>
      <label>
        Email
        <input className="field" type="email" name="email" required style={{ marginTop: 4 }} />
      </label>
      <label>
        Password
        <input className="field" type="password" name="password" required minLength={8} style={{ marginTop: 4 }} />
      </label>
      <label>
        Role
        <select className="field" name="role" defaultValue="analyst" style={{ marginTop: 4 }}>
          <option value="analyst">Analyst</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      {state.error && (
        <p className="text-danger" style={{ margin: 0, fontSize: 14 }}>
          {state.error}
        </p>
      )}
      {state.success && (
        <p style={{ color: "var(--color-success)", margin: 0, fontSize: 14 }}>User created.</p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}
