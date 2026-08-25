"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createEmployee, type EmployeeFormState } from "@/lib/employee-actions";
import { COMMISSION_TYPE_LABELS } from "@/lib/constants";

const EMPTY: EmployeeFormState = {};

export function EmployeeForm() {
  const [state, action, pending] = useActionState(createEmployee, EMPTY);
  const [commissionType, setCommissionType] = useState("PERCENT");
  const [copied, setCopied] = useState(false);

  // Het wachtwoord is alleen op dit scherm te zien: er staat een hash in de
  // database, dus later opvragen kan niet meer. Daarom komt het formulier pas
  // terug nadat het genoteerd is.
  if (state.createdPassword) {
    return (
      <section className="panel p-6 space-y-4 max-w-xl">
        <div>
          <p className="label text-[var(--accent)]">Account aangemaakt</p>
          <h2 className="display text-xl font-semibold mt-1">
            {state.createdName}
          </h2>
        </div>

        <p className="text-sm text-[var(--text-dim)]">
          Geef dit wachtwoord door. Het is hierna niet meer op te vragen — je kunt
          dan alleen een nieuw wachtwoord instellen.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <code className="mono text-lg border border-[var(--border)] px-3 py-2 select-all break-all">
            {state.createdPassword}
          </code>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              void navigator.clipboard
                .writeText(state.createdPassword ?? "")
                .then(() => setCopied(true));
            }}
          >
            {copied ? "Gekopieerd" : "Kopiëren"}
          </button>
        </div>

        <div className="flex gap-2 pt-2">
          <Link href="/team" className="btn btn-primary">
            Klaar
          </Link>
          <Link href="/team/new" className="btn btn-ghost">
            Nog een toevoegen
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form action={action} className="panel p-6 space-y-4 max-w-xl">
      {state.error && (
        <p className="text-sm" style={{ color: "var(--alert)" }}>
          {state.error}
        </p>
      )}

      <Field label="Naam">
        <input name="name" className="input" required maxLength={120} />
      </Field>

      <Field label="E-mailadres" hint="Hiermee meldt de medewerker zich aan.">
        <input name="email" type="email" className="input" required />
      </Field>

      <Field label="Foto" hint="JPG, PNG of WebP, hoogstens 2 MB. Mag later.">
        <input
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="input"
        />
      </Field>

      <Field label="Rol" hint="Verkoop ziet Mijn leads en Leads.">
        <select name="role" className="select" defaultValue="sales">
          <option value="sales">Verkoop</option>
          <option value="reviewer">Meelezer</option>
          <option value="admin">Beheerder</option>
        </select>
      </Field>

      <Field label="Kost per maand (€)" hint="Loon en vaste lasten samen.">
        <input
          name="monthlyCost"
          type="number"
          min="0"
          step="1"
          defaultValue="0"
          className="input"
        />
      </Field>

      <Field label="Soort commissie">
        <select
          name="commissionType"
          className="select"
          value={commissionType}
          onChange={(event) => setCommissionType(event.target.value)}
        >
          {Object.entries(COMMISSION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={commissionType === "PERCENT" ? "Commissie (%)" : "Commissie (€)"}
        hint={
          commissionType === "PERCENT"
            ? "Deel van de verkoopwaarde, bijvoorbeeld 5."
            : "Vast bedrag per verkoop, ongeacht de waarde."
        }
      >
        <input
          name="commissionValue"
          type="number"
          min="0"
          step={commissionType === "PERCENT" ? "0.5" : "1"}
          max={commissionType === "PERCENT" ? "100" : undefined}
          defaultValue="0"
          className="input"
        />
      </Field>

      <Field
        label="Huurcommissie (€)"
        hint="Vast bedrag per geslaagd shop-huurcontract in Diksmuide."
      >
        <input
          name="rentalCommissionFixed"
          type="number"
          min="0"
          step="1"
          defaultValue="0"
          className="input"
        />
      </Field>

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Bezig…" : "Account aanmaken"}
        </button>
        <Link href="/team" className="btn btn-ghost">
          Annuleren
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[var(--text-dim)]">{hint}</span>}
    </label>
  );
}
