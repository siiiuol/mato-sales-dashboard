"use client";

import { useActionState } from "react";
import {
  generateContentIdeas,
  generateOchtendbrief,
  type AiosTextState,
} from "@/lib/aios-actions";

const EMPTY: AiosTextState = {};

export function OchtendbriefPanel() {
  const [state, action, pending] = useActionState(generateOchtendbrief, EMPTY);

  return (
    <div className="space-y-4">
      <form action={action}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Bezig…" : "Ochtendbrief maken"}
        </button>
      </form>
      <p className="text-sm text-[var(--text-dim)]">
        Gebruikt jouw open leads en taken in MATO OS. Niets wordt verstuurd.
      </p>
      {state.error && (
        <p className="text-sm" style={{ color: "var(--alert)" }}>
          {state.error}
        </p>
      )}
      {state.focus && (
        <div className="panel p-4 bg-[var(--gold-wash)]">
          <h3 className="label text-[var(--accent)] mb-2">Focus vandaag</h3>
          <pre className="aios-output border-0 bg-transparent p-0 shadow-none">
            {state.focus}
          </pre>
        </div>
      )}
      {state.markdown && <pre className="aios-output">{state.markdown}</pre>}
    </div>
  );
}

export function ContentIdeasPanel() {
  const [state, action, pending] = useActionState(generateContentIdeas, EMPTY);

  return (
    <div className="space-y-4">
      <form action={action}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Bezig…" : "Contentideeën (koop/huur)"}
        </button>
      </form>
      {state.error && (
        <p className="text-sm" style={{ color: "var(--alert)" }}>
          {state.error}
        </p>
      )}
      {state.markdown && <pre className="aios-output">{state.markdown}</pre>}
    </div>
  );
}
