"use client";

import { useActionState } from "react";
import {
  registerMachinePlacement,
  type MachineFormState,
} from "@/lib/machine-actions";

const EMPTY: MachineFormState = {};

type Product = { id: string; name: string; line: string };

/** Registreert een automaat bij deze klant. Zelfde key-remount patroon als de andere formulieren. */
export function MachinePlacementForm({
  customerId,
  products,
}: {
  customerId: string;
  products: Product[];
}) {
  const [state, action, pending] = useActionState(registerMachinePlacement, EMPTY);
  return (
    <Fields
      key={state.savedId ?? "leeg"}
      customerId={customerId}
      products={products}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

function Fields({
  customerId,
  products,
  state,
  action,
  pending,
}: {
  customerId: string;
  products: Product[];
  state: MachineFormState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="customerId" value={customerId} />
      <select name="productId" className="select" defaultValue="">
        <option value="">Model uit de catalogus (optioneel)</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.line}
          </option>
        ))}
      </select>
      <input name="model" className="input" placeholder="Modelnaam (vrije tekst, indien niet in de lijst)" maxLength={150} />
      <input name="serialNumber" className="input" placeholder="Serienummer (optioneel)" maxLength={100} />
      <input name="address" className="input" placeholder="Adres" maxLength={300} />
      <input name="city" className="input" placeholder="Gemeente" maxLength={100} />
      <textarea name="notes" className="textarea" rows={2} placeholder="Notitie (optioneel)" />

      {state.error && (
        <p className="text-sm" style={{ color: "var(--alert)" }} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Bezig…" : "Automaat registreren"}
      </button>
    </form>
  );
}
