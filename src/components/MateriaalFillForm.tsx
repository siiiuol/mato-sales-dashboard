"use client";

import { useMemo, useState } from "react";
import { MATO_FIELD_LABELS } from "@/lib/mato-pdf-templates";
import { fillMateriaalDocument } from "@/lib/materiaal-actions";
import { DocumentLivePreview } from "@/components/DocumentLivePreview";
import type { DocumentContext } from "@/lib/documents";

function labelFor(key: string) {
  return (
    MATO_FIELD_LABELS[key] ??
    key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

type LeadOption = { id: string; name: string; city: string | null };

/**
 * Invulformulier met live markdown-preview van het actieve sjabloon.
 */
export function MateriaalFillForm({
  templateCode,
  templateBody,
  fields,
  defaults,
  leads,
}: {
  templateCode: string;
  templateBody: string;
  fields: string[];
  defaults: Record<string, string>;
  leads: LeadOption[];
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...defaults,
  }));

  const context: DocumentContext = useMemo(() => {
    const ctx: DocumentContext = {
      datum: new Date().toLocaleDateString("nl-BE"),
      documentnummer: "VOORBEELD",
    };
    for (const key of fields) {
      ctx[key] = values[key] ?? "";
    }
    return ctx;
  }, [fields, values]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={fillMateriaalDocument} className="space-y-4">
        <input type="hidden" name="templateCode" value={templateCode} />

        {leads.length > 0 && (
          <label className="block space-y-1">
            <span className="label">Koppelen aan lead (optioneel)</span>
            <select name="leadId" className="select" defaultValue="">
              <option value="">Geen — alleen document</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.city ? ` · ${l.city}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f} className="block space-y-1 sm:col-span-1">
              <span className="text-sm text-[var(--text-dim)]">{labelFor(f)}</span>
              {f.includes("opmerkingen") ||
              f.includes("factuurlijnen") ||
              f.includes("assortiment") ? (
                <textarea
                  name={`field_${f}`}
                  className="input min-h-[5rem]"
                  value={values[f] ?? ""}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [f]: event.target.value }))
                  }
                />
              ) : (
                <input
                  name={`field_${f}`}
                  className="input"
                  value={values[f] ?? ""}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [f]: event.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </div>

        {fields.length === 0 && (
          <p className="text-sm text-[var(--text-dim)]">
            Dit sjabloon heeft geen extra velden — u krijgt meteen een genummerd
            document (datum en nummer worden automatisch gezet).
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-press">
          Document opstellen
        </button>
        <p className="text-xs text-[var(--text-dim)]">
          Ontbrekende velden blijven zichtbaar als {"{{plaatshouder}}"} in het
          concept — u kunt ze later aanvullen via een nieuw document.
        </p>
      </form>

      <DocumentLivePreview
        templateBody={templateBody}
        context={context}
        title="Live voorbeeld"
      />
    </div>
  );
}
