"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/auth-actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label block mb-1">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" className="input" required />
      </div>
      <div>
        <label htmlFor="password" className="label block mb-1">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="input"
          minLength={8}
          required
        />
      </div>
      {state.error && (
        <p className="text-sm text-[var(--danger)]" role="alert">{state.error}</p>
      )}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Authenticating…" : "Enter sales OS"}
      </button>
    </form>
  );
}
