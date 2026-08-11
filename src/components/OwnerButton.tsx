"use client";

import { useState, useTransition } from "react";

/**
 * "Voeg toe aan mijn leads", en wat er in plaats daarvan staat als de zaak al
 * bezet is.
 *
 * Het is met opzet zichtbaar van wie de lead is en niet alleen dat hij bezet
 * is: als twee mensen op commissie werken, hoort duidelijk te zijn wie waaraan
 * bezig is, anders wordt elk misverstand een discussie over geld.
 */
export function OwnerButton({
  leadId,
  ownerId,
  ownerName,
  currentUserId,
  isAdmin,
  takeAction,
  releaseAction,
  compact,
}: {
  leadId: string;
  ownerId: string | null;
  ownerName: string | null;
  currentUserId: string;
  isAdmin: boolean;
  takeAction: (id: string) => Promise<void>;
  releaseAction: (id: string) => Promise<void>;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const size = compact ? "btn btn-sm" : "btn";

  const run = (fn: (id: string) => Promise<void>) => () => {
    setError("");
    start(async () => {
      try {
        await fn(leadId);
      } catch (err) {
        // Een mislukte overname is geen storing maar informatie: iemand was je
        // voor. Die naam hoort de gebruiker te zien.
        setError(err instanceof Error ? err.message : "Dat is niet gelukt");
      }
    });
  };

  const mine = ownerId === currentUserId;
  const takenByOther = Boolean(ownerId) && !mine;

  if (takenByOther) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="badge" title="Deze lead staat op naam van een collega">
          {ownerName ?? "Collega"} werkt hieraan
        </span>
        {isAdmin && (
          <button
            type="button"
            className={`${size} btn-ghost`}
            disabled={pending}
            onClick={run(releaseAction)}
          >
            Vrijgeven
          </button>
        )}
        {error && (
          <span className="text-xs" style={{ color: "var(--alert)" }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  if (mine) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="badge badge-live">Van jou</span>
        <button
          type="button"
          className={`${size} btn-ghost`}
          disabled={pending}
          onClick={run(releaseAction)}
        >
          Teruggeven
        </button>
        {error && (
          <span className="text-xs" style={{ color: "var(--alert)" }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={`${size} btn-primary`}
        disabled={pending}
        onClick={run(takeAction)}
      >
        {pending ? "Bezig…" : "Aan mijn leads toevoegen"}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--alert)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
