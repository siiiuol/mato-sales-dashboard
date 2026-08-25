"use client";

import { useActionState, useState } from "react";
import {
  CONTACT_TYPES,
  LOSS_REASONS,
  outcomesForType,
} from "@/lib/constants";
import { logContact, type ContactLogState } from "@/lib/contact-actions";

const EMPTY: ContactLogState = {};

/**
 * Contact noteren op de bedrijfsfiche.
 *
 * De buitenste component houdt alleen de actie vast; de velden zitten in
 * `Fields`, dat een `key` krijgt van het laatst opgeslagen contact. Een
 * geslaagde opslag geeft een nieuwe key, React bouwt het formulier opnieuw op,
 * en daarmee zijn de velden leeg en staat het soort weer op "gebeld".
 *
 * Dat leegmaken gebeurde eerder in een effect met `setState`. Dat werkt, maar
 * het is een tweede bron van waarheid over dezelfde toestand — en React
 * waarschuwt er terecht voor. Opnieuw opbouwen is één regel en heeft dat
 * probleem niet.
 */
export function ContactLogPanel({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(logContact, EMPTY);

  return (
    <Fields
      key={state.savedId ?? "leeg"}
      leadId={leadId}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

function Fields({
  leadId,
  state,
  action,
  pending,
}: {
  leadId: string;
  state: ContactLogState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [type, setType] = useState<string>("CALL");
  const [outcome, setOutcome] = useState("");
  const outcomes = outcomesForType(type);
  const needsOutcome = type !== "NOTE";
  const showFollowUp =
    type === "NOTE" ||
    type === "CALL" ||
    type === "EMAIL" ||
    type === "VISIT";

  return (
    <section className="panel p-4 space-y-3">
      <h2 className="label text-[var(--accent)]">Contact noteren</h2>
      <p className="text-sm text-[var(--text-dim)]">
        Alles wat je doet met deze zaak komt in de geschiedenis.
      </p>

      <form id={`contact-log-${leadId}`} action={action} className="space-y-3">
        <input type="hidden" name="leadId" value={leadId} />

        <div className="grid grid-cols-2 gap-2">
          {CONTACT_TYPES.map((item) => (
            <label
              key={item.value}
              className={
                type === item.value
                  ? "btn btn-primary cursor-pointer"
                  : "btn btn-ghost cursor-pointer"
              }
            >
              <input
                type="radio"
                name="type"
                value={item.value}
                className="sr-only"
                checked={type === item.value}
                onChange={() => {
                  setType(item.value);
                  setOutcome("");
                }}
              />
              {item.label}
            </label>
          ))}
        </div>

        {needsOutcome && (
          <div>
            <label className="label block mb-1">Resultaat</label>
            <select
              key={type}
              name="outcome"
              className="select"
              required
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            >
              <option value="" disabled>
                Kies…
              </option>
              {outcomes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {outcome === "NOT_INTERESTED" ? (
          <div>
            <label className="label block mb-1">Waarom stopt deze kans?</label>
            <select name="lossReason" className="select" required defaultValue="">
              <option value="" disabled>
                Kies een reden…
              </option>
              {LOSS_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="label block mb-1">
            {type === "NOTE" ? "Notitie" : "Notitie (optioneel)"}
          </label>
          <textarea
            name="note"
            className="textarea"
            rows={3}
            required={type === "NOTE"}
            placeholder={
              type === "NOTE"
                ? "Wat wil je onthouden?"
                : "Kort wat er gezegd of besloten is"
            }
          />
        </div>

        {showFollowUp && (
          <div>
            <label className="label block mb-1">Opvolgen op (optioneel)</label>
            <input type="datetime-local" name="callbackAt" className="input" />
          </div>
        )}

        {state.error && (
          <p className="text-sm" style={{ color: "var(--alert)" }} role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="text-sm text-[var(--accent)]">Opgeslagen</p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Bezig…" : "Opslaan"}
        </button>
      </form>
    </section>
  );
}
