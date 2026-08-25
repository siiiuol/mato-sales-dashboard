"use client";

import { useActionState } from "react";
import {
  enrichLeadProfile,
  type LeadProfileActionState,
} from "@/lib/lead-profile-actions";

const EMPTY: LeadProfileActionState = {};

export function LeadProfileEnrichPanel({
  leadId,
  enrichedAtLabel,
}: {
  leadId: string;
  enrichedAtLabel: string | null;
}) {
  const [state, action, pending] = useActionState(enrichLeadProfile, EMPTY);
  const hasProfile = Boolean(enrichedAtLabel || state.enriched);

  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="font-medium text-sm">Gerichte bedrijfsinfo</p>
          <p className="text-xs text-[var(--text-dim)]">
            Website, Google Places en een feitelijke AI-samenvatting. Alleen na uw klik.
          </p>
        </div>
        <form action={action}>
          <input type="hidden" name="leadId" value={leadId} />
          <button type="submit" className="btn btn-sm btn-primary" disabled={pending}>
            {pending
              ? "Profiel verrijken…"
              : hasProfile
                ? "Opnieuw verrijken"
                : "Profiel verrijken"}
          </button>
        </form>
      </div>

      {enrichedAtLabel ? (
        <p className="text-xs text-[var(--text-dim)]">
          Laatst verrijkt: {enrichedAtLabel}
        </p>
      ) : null}
      {state.enriched ? (
        <p className="text-sm text-[var(--ok)]">
          Profiel bijgewerkt
          {state.sources?.length ? ` via ${state.sources.join(", ")}` : ""}.
        </p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-[var(--alert)]">{state.error}</p>
      ) : null}
      {state.warnings?.length ? (
        <ul className="text-xs text-[var(--caution)] space-y-1">
          {state.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
