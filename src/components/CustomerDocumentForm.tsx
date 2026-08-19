"use client";

import { useState } from "react";
import { generateGenericDocument } from "@/lib/generic-document-actions";

export type GenericTemplateOption = {
  code: string;
  name: string;
  fields: string[];
};

/** Zet `klant_adres` om naar "Klant adres" — geen labeltabel nodig voor tientallen velden. */
function humanize(key: string) {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Genereert een document van eender welk actief sjabloon dat geen eigen knop
 * heeft (verkoopcontract en opstartbevestiging houden hun bestaande, gerichte
 * formulier). Klantvelden staan vooraf ingevuld; de rest — bedragen,
 * data, vrije tekst — vult de gebruiker zelf in, telkens opnieuw per document.
 */
export function CustomerDocumentForm({
  customerId,
  templates,
  defaults,
}: {
  customerId: string;
  templates: GenericTemplateOption[];
  defaults: Record<string, string>;
}) {
  const [code, setCode] = useState(templates[0]?.code ?? "");
  if (!templates.length) return null;
  const active = templates.find((t) => t.code === code) ?? templates[0];

  return (
    <form action={generateGenericDocument} className="space-y-2 border-t border-[var(--border)] pt-3">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="templateCode" value={active.code} />
      <select
        className="select"
        value={active.code}
        onChange={(e) => setCode(e.target.value)}
      >
        {templates.map((t) => (
          <option key={t.code} value={t.code}>
            {t.name}
          </option>
        ))}
      </select>
      {active.fields.map((f) => (
        <input
          key={`${active.code}-${f}`}
          name={`field_${f}`}
          className="input"
          placeholder={humanize(f)}
          defaultValue={defaults[f] ?? ""}
        />
      ))}
      <button type="submit" className="btn w-full">
        Document opstellen
      </button>
    </form>
  );
}
