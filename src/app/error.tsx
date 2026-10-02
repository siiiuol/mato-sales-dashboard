"use client";

import Link from "next/link";

function messageFor(error: Error) {
  const raw = error.message || "";
  if (raw.includes("#441") || raw.includes("Server Components render")) {
    return "De pagina kon niet geladen worden. Vernieuw, of ga terug naar het begin. Als dit blijft, is er een serverfout — geen fout in uw ingevulde gegevens.";
  }
  return raw || "Er ging iets mis bij het laden van deze pagina.";
}

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
  const minified = (error.message || "").includes("Minified React error");

  return (
    <div className="panel p-6 max-w-2xl mx-auto space-y-4 anim-lock">
      <div>
        <p className="label text-[var(--warn)]">
          {minified ? "Pagina niet geladen" : "Niet opgeslagen"}
        </p>
        <h1 className="display text-2xl font-semibold mt-1">Dat is niet gelukt</h1>
      </div>
      <p className="text-sm whitespace-pre-wrap">{messageFor(error)}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="button" onClick={reset}>
          Opnieuw proberen
        </button>
        <Link className="btn" href="/">
          Terug naar het begin
        </Link>
      </div>
      {error.digest && (
        <p className="mono text-xs text-[var(--text-mute)]">ref {error.digest}</p>
      )}
    </div>
  );
}
