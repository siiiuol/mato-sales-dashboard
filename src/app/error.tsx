"use client";

import Link from "next/link";

/**
 * Server actions in this app throw on refusal — an unapproved template, a
 * document with validation blockers, a missing approver name. Those messages
 * are written for the person using MATO OS, so show them instead of a crash.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel p-6 max-w-2xl mx-auto space-y-4 anim-lock">
      <div>
        <p className="label text-[var(--warn)]">Action refused</p>
        <h1 className="display text-2xl font-semibold mt-1">That didn&apos;t go through</h1>
      </div>
      <p className="text-sm whitespace-pre-wrap">{error.message}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="btn" href="/">
          Back to Command Center
        </Link>
      </div>
      {error.digest && (
        <p className="mono text-xs text-[var(--text-mute)]">ref {error.digest}</p>
      )}
    </div>
  );
}
