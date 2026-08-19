"use client";

import { useActionState } from "react";
import {
  CONTACT_ROLES,
  CONTACT_INFLUENCE,
  CONTACT_CONSENT,
  CONTACT_ROLE_LABELS,
  CONTACT_INFLUENCE_LABELS,
  CONTACT_CONSENT_LABELS,
} from "@/lib/constants";
import { createContact, type ContactFormState } from "@/lib/customer-actions";

const EMPTY: ContactFormState = {};

/**
 * Contactpersoon toevoegen op een klantfiche.
 *
 * Zelfde opbouw als `ContactLogPanel`: de buitenste component houdt alleen de
 * actie vast, `Fields` krijgt een `key` die verandert bij elke geslaagde
 * opslag, en React bouwt het formulier dan leeg opnieuw op.
 */
export function ContactPersonForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(createContact, EMPTY);
  return (
    <Fields
      key={state.savedId ?? "leeg"}
      customerId={customerId}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

function Fields({
  customerId,
  state,
  action,
  pending,
}: {
  customerId: string;
  state: ContactFormState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="firstName" className="input" placeholder="Voornaam" required maxLength={100} />
        <input name="lastName" className="input" placeholder="Achternaam" maxLength={100} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="jobTitle" className="input" placeholder="Functie (optioneel)" maxLength={150} />
        <select name="role" className="select" defaultValue="GENERAL">
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {CONTACT_ROLE_LABELS[r] ?? r}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="email" type="email" className="input" placeholder="E-mail" maxLength={200} />
        <input name="phone" className="input" placeholder="Telefoon" maxLength={30} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="influence" className="select" defaultValue="UNKNOWN">
          {CONTACT_INFLUENCE.map((v) => (
            <option key={v} value={v}>
              Invloed: {CONTACT_INFLUENCE_LABELS[v] ?? v}
            </option>
          ))}
        </select>
        <select name="consent" className="select" defaultValue="UNKNOWN">
          {CONTACT_CONSENT.map((v) => (
            <option key={v} value={v}>
              Toestemming: {CONTACT_CONSENT_LABELS[v] ?? v}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="decisionMaker" />
        Beslist mee over een aankoop
      </label>
      <textarea name="notes" className="textarea" rows={2} placeholder="Notitie (optioneel)" />

      {state.error && (
        <p className="text-sm" style={{ color: "var(--alert)" }} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Bezig…" : "Contactpersoon toevoegen"}
      </button>
    </form>
  );
}
