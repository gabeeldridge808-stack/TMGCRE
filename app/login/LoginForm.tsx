"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="card" style={{ display: "grid", gap: 16 }}>
      <input type="hidden" name="next" value={next} />
      <label>
        Email
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input className="field" type="email" name="email" required autoFocus style={{ marginTop: 4 }} />
      </label>
      <label>
        Password
        <input className="field" type="password" name="password" required style={{ marginTop: 4 }} />
      </label>
      {state.error && (
        <p className="text-danger" style={{ margin: 0, fontSize: 14 }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
