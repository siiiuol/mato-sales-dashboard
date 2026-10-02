"use client";

import { useActionState } from "react";
import {
  addCustomerFact,
  confirmCustomerFact,
  rejectCustomerFact,
  type FactActionState,
} from "@/lib/customer-memory-actions";
import { FACT_KEYS, factLabel } from "@/lib/customer-memory";

export type MemoryFact = {
  id: string;
  key: string;
  value: string;
  status: string;
  source: string;
  confidence: number;
};

const EMPTY: FactActionState = {};

export function CustomerMemoryPanel({
  leadId,
  facts,
  canEdit,
}: {
  leadId: string;
  facts: MemoryFact[];
  canEdit: boolean;
}) {
  const confirmed = facts.filter((f) => f.status === "CONFIRMED");
  const suggested = facts.filter((f) => f.status === "SUGGESTED");

  if (!confirmed.length && !suggested.length && !canEdit) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="label text-[var(--accent)]">Geheugen</h2>

      {confirmed.length === 0 && suggested.length === 0 ? (
        <p className="text-sm text-[var(--text-dim)]">
          Nog geen feiten. Na een antwoord per mail verschijnen hier voorstellen.
        </p>
      ) : null}

      {confirmed.length > 0 ? (
        <ul className="ios-list">
          {confirmed.map((fact) => (
            <li
              key={fact.id}
              className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--line)] last:border-0"
            >
              <span className="min-w-0">
                <span className="block text-xs text-[var(--text-dim)]">
                  {factLabel(fact.key)}
                </span>
                <span className="block font-medium">{fact.value}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {suggested.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-dim)]">
            Voorstellen uit mail — bevestig alleen wat klopt.
          </p>
          <ul className="space-y-2">
            {suggested.map((fact) => (
              <SuggestedRow key={fact.id} fact={fact} canEdit={canEdit} />
            ))}
          </ul>
        </div>
      ) : null}

      {canEdit ? <AddFactForm leadId={leadId} /> : null}
    </section>
  );
}

function SuggestedRow({
  fact,
  canEdit,
}: {
  fact: MemoryFact;
  canEdit: boolean;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmCustomerFact,
    EMPTY
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectCustomerFact,
    EMPTY
  );
  const pending = confirmPending || rejectPending;
  const error = confirmState.error || rejectState.error;

  return (
    <li className="rounded-lg border border-[var(--line)] px-3 py-2 space-y-2">
      <div>
        <p className="text-xs text-[var(--text-dim)]">{factLabel(fact.key)}</p>
        <p className="font-medium text-sm">{fact.value}</p>
      </div>
      {canEdit ? (
        <div className="flex gap-2">
          <form action={confirmAction}>
            <input type="hidden" name="factId" value={fact.id} />
            <button
              type="submit"
              className="btn btn-primary py-1 min-h-0 text-sm"
              disabled={pending}
            >
              Klopt
            </button>
          </form>
          <form action={rejectAction}>
            <input type="hidden" name="factId" value={fact.id} />
            <button
              type="submit"
              className="btn py-1 min-h-0 text-sm"
              disabled={pending}
            >
              Weg
            </button>
          </form>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </li>
  );
}

function AddFactForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(addCustomerFact, EMPTY);

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-[var(--text-dim)]">
        Feit toevoegen
      </summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <select name="key" className="select w-full" required defaultValue="">
          <option value="" disabled>
            Kies soort
          </option>
          {FACT_KEYS.map((key) => (
            <option key={key} value={key}>
              {factLabel(key)}
            </option>
          ))}
        </select>
        <input
          name="value"
          className="input w-full"
          placeholder="Waarde"
          required
          maxLength={500}
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Bezig…" : "Bewaren"}
        </button>
        {state.error ? (
          <p className="text-xs text-[var(--danger)]">{state.error}</p>
        ) : null}
      </form>
    </details>
  );
}
