"use client";

import { useActionState } from "react";
import {
  createShopTenant,
  type ShopTenantFormState,
} from "@/lib/shop-actions";
import { SHOP_CONTRACT_TYPES, SHOP_DIKSMUIDE } from "@/lib/constants";

const EMPTY: ShopTenantFormState = {};

type Product = { id: string; name: string; line: string };

export function ShopTenantForm({
  products,
  freeSlots,
  defaultSlot,
  prefill,
}: {
  products: Product[];
  freeSlots: number[];
  defaultSlot?: number | null;
  prefill?: {
    leadId: string;
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
  } | null;
}) {
  const [state, action, pending] = useActionState(createShopTenant, EMPTY);
  const preferred =
    defaultSlot && freeSlots.includes(defaultSlot)
      ? defaultSlot
      : freeSlots[0] ?? "";

  return (
    <form action={action} className="space-y-4 max-w-xl">
      <input type="hidden" name="leadId" value={prefill?.leadId ?? ""} />
      <p className="text-sm text-[var(--text-dim)]">
        Locatie vast: {SHOP_DIKSMUIDE.address}, {SHOP_DIKSMUIDE.postalCode}{" "}
        {SHOP_DIKSMUIDE.city}. Beperkte showroomplaatsen.
      </p>

      <fieldset className="space-y-2">
        <legend className="label text-[var(--accent)]">Partner</legend>
        <input
          name="name"
          className="input"
          placeholder="Naam / bedrijf"
          required
          maxLength={200}
          defaultValue={prefill?.name ?? ""}
        />
        <input
          name="phone"
          className="input"
          placeholder="Telefoon"
          maxLength={40}
          defaultValue={prefill?.phone ?? ""}
        />
        <input
          name="email"
          className="input"
          type="email"
          placeholder="E-mail"
          defaultValue={prefill?.email ?? ""}
        />
        <textarea
          name="notes"
          className="textarea"
          rows={2}
          placeholder="Notitie"
          defaultValue={prefill?.notes ?? ""}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label text-[var(--accent)]">Plaats in de shop</legend>
        {freeSlots.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--alert)" }}>
            Geen vrije plaatsen meer. Verhoog de capaciteit (admin) of maak een
            plek vrij.
          </p>
        ) : (
          <select
            name="shopSlot"
            className="select"
            required
            defaultValue={String(preferred)}
          >
            {freeSlots.map((n) => (
              <option key={n} value={n}>
                Plaats {n}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label text-[var(--accent)]">Automaat</legend>
        <select name="productId" className="select" defaultValue="">
          <option value="">Model uit catalogus (optioneel)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.line}
            </option>
          ))}
        </select>
        <input name="model" className="input" placeholder="Model (vrije tekst)" maxLength={150} />
        <input name="serialNumber" className="input" placeholder="Serienummer" maxLength={100} />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label text-[var(--accent)]">Contract</legend>
        <select name="contractType" className="select" required defaultValue="FIXED">
          {SHOP_CONTRACT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          name="contractRef"
          className="input"
          placeholder="Contractref. / documentnr. (optioneel)"
          maxLength={120}
        />
        <label className="block space-y-1">
          <span className="text-sm text-[var(--text-dim)]">Start contract</span>
          <input name="contractStartedAt" type="date" className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-[var(--text-dim)]">Einde contract</span>
          <input name="contractEndsAt" type="date" className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-[var(--text-dim)]">
            Opzegtermijn in dagen
          </span>
          <input
            name="noticePeriodDays"
            type="number"
            min={0}
            max={365}
            className="input"
            defaultValue={30}
          />
        </label>
        <textarea
          name="placementNotes"
          className="textarea"
          rows={2}
          placeholder="Notitie bij plaatsing"
        />
      </fieldset>

      {state.error && (
        <p className="text-sm" style={{ color: "var(--alert)" }} role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending || freeSlots.length === 0}
      >
        {pending ? "Bezig…" : "Huurder opslaan"}
      </button>
    </form>
  );
}
