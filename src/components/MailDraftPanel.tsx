"use client";

import { useActionState, useState } from "react";
import {
  deleteMailDraft,
  generateMailDraft,
  saveMailDraft,
  type MailDraftState,
} from "@/lib/mail-actions";

const EMPTY: MailDraftState = {};

type SavedDraft = {
  id: string;
  subject: string;
  body: string;
  status: string;
  createdAt: Date;
  createdBy: { name: string } | null;
};

/**
 * Mail opstellen, nalezen en bewaren.
 *
 * Versturen zit hier bewust niet bij. De tekst komt van een model en gaat naar
 * een klant; die stap hoort een aparte, bewuste handeling te zijn en niet iets
 * wat gebeurt omdat je één keer te snel klikt.
 */
export function MailDraftPanel({
  leadId,
  hasWebsite,
  drafts,
}: {
  leadId: string;
  hasWebsite: boolean;
  drafts: SavedDraft[];
}) {
  const [state, action, pending] = useActionState(generateMailDraft, EMPTY);
  const [editing, setEditing] = useState<SavedDraft | null>(null);

  const fresh = state.draftId
    ? {
        id: state.draftId,
        subject: state.subject ?? "",
        body: state.body ?? "",
        status: "PREPARED",
        createdAt: new Date(),
        createdBy: null,
      }
    : null;

  const shown = editing ?? fresh;

  return (
    <div className="space-y-3">
      {!shown && (
        <form action={action} className="space-y-2">
          <input type="hidden" name="leadId" value={leadId} />
          {hasWebsite && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="useWebsite" defaultChecked />
              <span>Website van de zaak meelezen</span>
            </label>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={pending}>
            {pending ? "Bezig met opstellen…" : "Mail opstellen"}
          </button>
          <p className="text-xs text-[var(--text-dim)]">
            De tekst wordt opgesteld, niet verstuurd. Je leest hem eerst na.
          </p>
        </form>
      )}

      {state.error && (
        <p className="text-sm" style={{ color: "var(--alert)" }}>
          {state.error}
        </p>
      )}

      {shown && (
        <form action={saveMailDraft} className="space-y-2">
          <input type="hidden" name="draftId" value={shown.id} />
          <label className="block">
            <span className="label">Onderwerp</span>
            <input
              name="subject"
              className="input mt-1"
              defaultValue={shown.subject}
              maxLength={300}
              required
            />
          </label>
          <label className="block">
            <span className="label">Bericht</span>
            <textarea
              name="body"
              className="textarea mt-1"
              rows={12}
              defaultValue={shown.body}
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary">
              Bewaren
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(null)}
            >
              Sluiten
            </button>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Lees na op namen, bedragen en beloftes. Wat hier staat is opgesteld
            door een taalmodel en kan iets beweren wat niet klopt.
          </p>
        </form>
      )}

      {drafts.length > 0 && (
        <ul className="space-y-2 text-sm border-t border-[var(--border)] pt-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex justify-between gap-2 items-start">
              <button
                type="button"
                className="text-left hover:text-[var(--accent)]"
                onClick={() => setEditing(draft)}
              >
                <span className="block">{draft.subject}</span>
                <span className="text-xs text-[var(--text-dim)]">
                  {draft.createdBy?.name ?? "onbekend"} ·{" "}
                  {new Date(draft.createdAt).toLocaleDateString("nl-BE")} ·{" "}
                  {draft.status === "APPROVED" ? "nagelezen" : "concept"}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost shrink-0"
                onClick={() => void deleteMailDraft(draft.id)}
              >
                Weg
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
