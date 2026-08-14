"use client";

import { useActionState } from "react";
import { syncReplies, type MailSyncState } from "@/lib/mail-actions";

const EMPTY: MailSyncState = {};

/**
 * Haalt binnengekomen antwoorden op en zet ze bij de juiste lead.
 *
 * Met de hand, omdat er nog geen achtergrondtaak draait. Het knopje staat op de
 * leadfiche zelf zodat je het indrukt op het moment dat je een antwoord
 * verwacht.
 */
export function ReplySyncButton() {
  const [state, action, pending] = useActionState(
    async () => syncReplies(),
    EMPTY
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <button type="submit" className="btn btn-sm btn-ghost" disabled={pending}>
        {pending ? "Bezig…" : "Antwoorden ophalen"}
      </button>
      {state.error ? (
        <span className="text-xs" style={{ color: "var(--alert)" }}>
          {state.error}
        </span>
      ) : state.checked ? (
        <span className="text-xs text-[var(--text-dim)]">
          {state.added
            ? `${state.added} nieuw${state.added === 1 ? "" : "e"}`
            : "niets nieuws"}
          {/* Stil afkappen zou "niets nieuws" laten liegen over een antwoord
              dat wel degelijk binnenkwam. */}
          {state.truncated && (
            <span style={{ color: "var(--caution)" }}> · nog niet alles, druk nogmaals</span>
          )}
          {Boolean(state.failed) && (
            <span style={{ color: "var(--alert)" }}>
              {" "}
              · {state.failed} niet kunnen opslaan
            </span>
          )}
        </span>
      ) : null}
    </form>
  );
}
