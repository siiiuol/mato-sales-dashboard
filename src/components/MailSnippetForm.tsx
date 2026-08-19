"use client";

import { useState } from "react";
import { MAIL_SITUATIONS } from "@/lib/constants";
import {
  createMailSnippet,
  updateMailSnippet,
  archiveMailSnippet,
} from "@/lib/mail-snippet-actions";

/**
 * Eén mailtekst beheren: toevoegen, en per bestaande tekst bewerken of
 * archiveren. Zelfde bewerk-in-plaats-patroon als `MailDraftPanel`'s
 * `DraftEditor` — de rij wordt het formulier, geen aparte pagina nodig voor
 * iets dat een handvol regels tekst is.
 *
 * Gewone `<form action={...}>` zonder `useActionState`: net als "Verkoop
 * noteren" op de leadfiche heeft dit geen client-side foutmelding of
 * pending-status nodig — de pagina herlaadt gewoon met het resultaat.
 */
export function NewMailSnippetForm() {
  return (
    <form action={createMailSnippet} className="space-y-2">
      <select name="situation" className="select" defaultValue={MAIL_SITUATIONS[0].value}>
        {MAIL_SITUATIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input name="label" className="input" placeholder="Korte naam, bv. 'Bakkerij, geen reactie'" required maxLength={150} />
      <textarea
        name="body"
        className="textarea"
        rows={5}
        placeholder="Vertrekpunt voor de AI — geen kant-en-klare mail, een schets die aangepast wordt op de feiten."
        required
      />
      <button type="submit" className="btn btn-primary w-full">
        Tekst toevoegen
      </button>
    </form>
  );
}

export function MailSnippetRow({
  snippet,
}: {
  snippet: { id: string; situation: string; label: string; body: string };
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <li className="border-b border-[var(--border)] pb-3 last:border-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{snippet.label}</span>
          <div className="flex gap-2 shrink-0">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
              Bewerken
            </button>
            <form action={archiveMailSnippet}>
              <input type="hidden" name="snippetId" value={snippet.id} />
              <button type="submit" className="btn btn-sm btn-ghost">
                Archiveren
              </button>
            </form>
          </div>
        </div>
        <p className="text-sm text-[var(--text-dim)] whitespace-pre-wrap mt-1">{snippet.body}</p>
      </li>
    );
  }

  return (
    <li className="border-b border-[var(--border)] pb-3 last:border-0">
      <form action={updateMailSnippet} className="space-y-2">
        <input type="hidden" name="snippetId" value={snippet.id} />
        <select name="situation" className="select" defaultValue={snippet.situation}>
          {MAIL_SITUATIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input name="label" className="input" defaultValue={snippet.label} required maxLength={150} />
        <textarea name="body" className="textarea" rows={5} defaultValue={snippet.body} required />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" onClick={() => setEditing(false)}>
            Bewaren
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Annuleren
          </button>
        </div>
      </form>
    </li>
  );
}
