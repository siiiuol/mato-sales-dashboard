"use client";

import { useActionState, useState } from "react";
import {
  generateLeadBrief,
  generateVoorstel,
  saveLeadBrief,
  saveVoorstel,
  type AiosTextState,
} from "@/lib/aios-actions";

const EMPTY: AiosTextState = {};

/**
 * Assistent op de leadfiche: brief of voorstel opstellen en terugschrijven.
 */
export function AiosAssistPanel({ leadId }: { leadId: string }) {
  const [mode, setMode] = useState<"brief" | "voorstel">("brief");

  return (
    <section className="panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label text-[var(--accent)]">Assistent</h2>
        <div className="flex gap-1">
          <button
            type="button"
            className="nav-link text-xs"
            data-active={mode === "brief"}
            onClick={() => setMode("brief")}
          >
            Brief
          </button>
          <button
            type="button"
            className="nav-link text-xs"
            data-active={mode === "voorstel"}
            onClick={() => setMode("voorstel")}
          >
            Voorstel
          </button>
        </div>
      </div>
      <p className="text-xs text-[var(--text-dim)]">
        Koop of huur — opstellen, nalezen, dan opslaan op deze fiche. Er gaat
        niets de deur uit.
      </p>
      {mode === "brief" ? (
        <BriefFlow key="brief" leadId={leadId} />
      ) : (
        <VoorstelFlow key="voorstel" leadId={leadId} />
      )}
    </section>
  );
}

function BriefFlow({ leadId }: { leadId: string }) {
  const [gen, genAction, genPending] = useActionState(generateLeadBrief, EMPTY);
  const [save, saveAction, savePending] = useActionState(saveLeadBrief, EMPTY);
  const state = save.saved ? save : gen;

  return (
    <div className="space-y-3">
      {!state.markdown && (
        <form action={genAction}>
          <input type="hidden" name="leadId" value={leadId} />
          <button type="submit" className="btn btn-primary w-full" disabled={genPending}>
            {genPending ? "Brief opstellen…" : "Zaak-brief maken"}
          </button>
        </form>
      )}

      {(gen.error || save.error) && (
        <p className="text-sm" style={{ color: "var(--alert)" }}>
          {save.error ?? gen.error}
        </p>
      )}

      {save.saved && (
        <p className="text-sm" style={{ color: "var(--ok)" }}>
          Opgeslagen op de fiche (aanpak + notitie).
        </p>
      )}

      {state.markdown && (
        <>
          {state.dealPath && (
            <p className="text-sm">
              Pad: <strong>{state.dealPath}</strong>
              {state.nextStep ? ` · ${state.nextStep}` : ""}
            </p>
          )}
          <pre className="aios-output">{state.markdown}</pre>
          <form action={saveAction} className="space-y-2">
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="markdown" value={state.markdown} />
            <input type="hidden" name="dealPath" value={state.dealPath ?? ""} />
            <input type="hidden" name="angle" value={state.angle ?? ""} />
            <input type="hidden" name="questions" value={state.questions ?? ""} />
            <input type="hidden" name="objections" value={state.objections ?? ""} />
            <input type="hidden" name="nextStep" value={state.nextStep ?? ""} />
            <button type="submit" className="btn btn-primary w-full" disabled={savePending}>
              {savePending ? "Opslaan…" : "Opslaan op fiche"}
            </button>
          </form>
          <form action={genAction}>
            <input type="hidden" name="leadId" value={leadId} />
            <button type="submit" className="btn w-full" disabled={genPending}>
              Opnieuw opstellen
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function VoorstelFlow({ leadId }: { leadId: string }) {
  const [gen, genAction, genPending] = useActionState(generateVoorstel, EMPTY);
  const [save, saveAction, savePending] = useActionState(saveVoorstel, EMPTY);
  const state = save.saved ? save : gen;

  return (
    <div className="space-y-3">
      {!state.markdown && (
        <form action={genAction}>
          <input type="hidden" name="leadId" value={leadId} />
          <button type="submit" className="btn btn-primary w-full" disabled={genPending}>
            {genPending ? "Voorstel opstellen…" : "Voorstel maken (koop/huur)"}
          </button>
        </form>
      )}

      {(gen.error || save.error) && (
        <p className="text-sm" style={{ color: "var(--alert)" }}>
          {save.error ?? gen.error}
        </p>
      )}

      {save.saved && (
        <p className="text-sm" style={{ color: "var(--ok)" }}>
          Voorstel opgeslagen op de fiche.
        </p>
      )}

      {state.markdown && (
        <>
          {state.title && <p className="text-sm font-medium">{state.title}</p>}
          {state.dealPath && (
            <p className="text-xs text-[var(--text-dim)]">Pad: {state.dealPath}</p>
          )}
          <pre className="aios-output">{state.markdown}</pre>
          <form action={saveAction} className="space-y-2">
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="markdown" value={state.markdown} />
            <input type="hidden" name="dealPath" value={state.dealPath ?? ""} />
            <input type="hidden" name="title" value={state.title ?? ""} />
            <input type="hidden" name="nextStep" value={state.nextStep ?? ""} />
            <button type="submit" className="btn btn-primary w-full" disabled={savePending}>
              {savePending ? "Opslaan…" : "Opslaan op fiche"}
            </button>
          </form>
          <form action={genAction}>
            <input type="hidden" name="leadId" value={leadId} />
            <button type="submit" className="btn w-full" disabled={genPending}>
              Opnieuw opstellen
            </button>
          </form>
        </>
      )}
    </div>
  );
}
