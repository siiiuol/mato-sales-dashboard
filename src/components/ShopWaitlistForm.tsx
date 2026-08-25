"use client";

import { useActionState } from "react";
import {
  createShopWaitlistEntry,
  type ShopTenantFormState,
} from "@/lib/shop-actions";

const EMPTY: ShopTenantFormState = {};

export function ShopWaitlistForm({
  prefill,
}: {
  prefill?: {
    leadId: string;
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
  } | null;
}) {
  const [state, action, pending] = useActionState(
    createShopWaitlistEntry,
    EMPTY
  );
  return (
    <form action={action} className="panel p-5 space-y-3 max-w-xl">
      <input type="hidden" name="leadId" value={prefill?.leadId ?? ""} />
      <div>
        <p className="label text-[var(--accent)]">Wachtlijst</p>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Alle shopplaatsen zijn bezet. Bewaar de kandidaat zonder gegevens
          opnieuw te moeten ingeven.
        </p>
      </div>
      <input
        name="name"
        className="input"
        required
        placeholder="Naam / bedrijf"
        defaultValue={prefill?.name ?? ""}
      />
      <input
        name="phone"
        className="input"
        placeholder="Telefoon"
        defaultValue={prefill?.phone ?? ""}
      />
      <input
        name="email"
        type="email"
        className="input"
        placeholder="E-mail"
        defaultValue={prefill?.email ?? ""}
      />
      <textarea
        name="notes"
        className="textarea"
        rows={3}
        placeholder="Gewenst product, timing of andere notitie"
        defaultValue={prefill?.notes ?? ""}
      />
      {state.error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Bewaren…" : "Op wachtlijst zetten"}
      </button>
    </form>
  );
}
