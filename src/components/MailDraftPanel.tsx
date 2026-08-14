"use client";

import { useActionState, useState } from "react";
import {
  deleteMailDraft,
  generateMailDraft,
  saveMailDraft,
  sendMailDraft,
  type MailDraftState,
  type MailSendState,
} from "@/lib/mail-actions";

const EMPTY: MailDraftState = {};
const EMPTY_SEND: MailSendState = {};

type SavedDraft = {
  id: string;
  subject: string;
  body: string;
  status: string;
  createdAt: Date;
  createdBy: { name: string } | null;
};

/**
 * Mail opstellen, nalezen en versturen.
 *
 * Versturen is een aparte, tweede handeling met het adres in beeld. De tekst
 * komt van een model en gaat naar een klant; dat hoort niet te gebeuren omdat
 * iemand één keer te snel klikt.
 */
export function MailDraftPanel({
  leadId,
  hasWebsite,
  leadEmail,
  mailboxAddress,
  drafts,
}: {
  leadId: string;
  hasWebsite: boolean;
  leadEmail: string | null;
  /** Het gekoppelde postvak van deze medewerker, of null. */
  mailboxAddress: string | null;
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
        // De sleutel hangt aan het concept: een ander concept openen bouwt de
        // editor opnieuw op met die tekst erin. Dat scheelt een effect dat
        // state overschrijft — en daarmee het risico dat een aanpassing die
        // nog niet bewaard is onder je handen verdwijnt.
        <DraftEditor
          key={shown.id}
          draft={shown}
          leadEmail={leadEmail}
          mailboxAddress={mailboxAddress}
          onClose={() => setEditing(null)}
        />
      )}

      {drafts.length > 0 && (
        <ul className="space-y-2 text-sm border-t border-[var(--border)] pt-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex justify-between gap-2 items-start">
              {/* Een verstuurde mail is geen klad meer: hem opnieuw openen in de
                  verstuur-editor is precies hoe een prospect dezelfde mail twee
                  keer krijgt. */}
              {draft.status === "SENT" ? (
                <span className="text-left">
                  <span className="block">{draft.subject}</span>
                  <span className="text-xs text-[var(--text-dim)]">
                    {draft.createdBy?.name ?? "onbekend"} ·{" "}
                    {new Date(draft.createdAt).toLocaleDateString("nl-BE")} ·
                    verstuurd
                  </span>
                </span>
              ) : (
                <>
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
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Eén concept nalezen, bewaren en versturen.
 *
 * De tekst staat in state, niet alleen in het formulier: zo verstuurt de
 * tweede knop exact wat er op het scherm staat, ook als er tussendoor niet
 * bewaard is.
 */
function DraftEditor({
  draft,
  leadEmail,
  mailboxAddress,
  onClose,
}: {
  draft: SavedDraft;
  leadEmail: string | null;
  mailboxAddress: string | null;
  onClose: () => void;
}) {
  const [sendState, sendAction, sending] = useActionState(sendMailDraft, EMPTY_SEND);
  const [saveState, saveAction, saving] = useActionState(saveMailDraft, EMPTY_SEND);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [confirming, setConfirming] = useState(false);

  if (sendState.sent) {
    return (
      <div className="space-y-2">
        <p className="text-sm" style={{ color: "var(--ok)" }}>
          Verstuurd naar {sendState.to}. Het antwoord verschijnt op de tijdlijn
          zodra je op &ldquo;Antwoorden ophalen&rdquo; klikt.
        </p>
        {sendState.warning && (
          <p className="text-sm" style={{ color: "var(--caution)" }}>
            {sendState.warning}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form action={saveAction} className="space-y-2">
        <input type="hidden" name="draftId" value={draft.id} />
        <label className="block">
          <span className="label">Onderwerp</span>
          <input
            name="subject"
            className="input mt-1"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
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
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Bezig…" : "Bewaren"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Sluiten
          </button>
          {saveState.error ? (
            <span className="text-xs" style={{ color: "var(--alert)" }}>
              {saveState.error}
            </span>
          ) : saveState.saved ? (
            <span className="text-xs" style={{ color: "var(--ok)" }}>
              bewaard
            </span>
          ) : null}
        </div>
      </form>

      <div className="border-t border-[var(--border)] pt-3 space-y-2">
        {!mailboxAddress ? (
          <p className="text-xs text-[var(--text-dim)]">
            Koppel je mailbox bij Instellingen om vanuit MATO te versturen.
          </p>
        ) : !confirming ? (
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => setConfirming(true)}
            disabled={!subject.trim() || !body.trim()}
          >
            Versturen…
          </button>
        ) : (
          <form action={sendAction} className="space-y-2">
            <input type="hidden" name="draftId" value={draft.id} />
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="body" value={body} />
            <label className="block">
              <span className="label">Naar</span>
              <input
                name="to"
                type="email"
                className="input mt-1 mono"
                defaultValue={leadEmail ?? ""}
                placeholder="naam@zaak.be"
                required
              />
            </label>
            <p className="text-xs text-[var(--text-dim)]">
              Vertrekt van <span className="mono">{mailboxAddress}</span>. Lees na
              op namen, bedragen en beloftes — deze tekst is opgesteld door een
              taalmodel en kan iets beweren wat niet klopt.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? "Bezig met versturen…" : "Nu versturen"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirming(false)}
              >
                Toch niet
              </button>
            </div>
          </form>
        )}

        {sendState.error && (
          <p className="text-sm" style={{ color: "var(--alert)" }}>
            {sendState.error}
          </p>
        )}
      </div>
    </div>
  );
}
