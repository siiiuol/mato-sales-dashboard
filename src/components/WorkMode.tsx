"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { CALL_OUTCOMES, categoryLabel, WORK_STEPS } from "@/lib/constants";
import { claimLead, contactLead, skipLead } from "@/lib/actions";

type Step = "review" | "call" | "log";

/** Everything the triage and call cards render about a lead. */
export type WorkLead = {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  score: number;
  reason: string | null;
  hasVending: boolean;
  vendingDetail: string | null;
  nearbyVending: number;
  sellsTakeaway: boolean;
  phoneOpener: string | null;
  recommendedAngle: string | null;
  recommendedMachine: string | null;
  discoveryQuestions: string | null;
  likelyObjection: string | null;
  evidenceSummary: string | null;
};

/** Eén bron voor de belresultaten, gedeeld met de losse Bellen-pagina. */
const PRIMARY_VALUES = ["NO_ANSWER", "CALLBACK", "INTERESTED", "NOT_INTERESTED"];
const PRIMARY_OUTCOMES = CALL_OUTCOMES.filter((o) => PRIMARY_VALUES.includes(o.value));
const MORE_OUTCOMES = CALL_OUTCOMES.filter((o) => !PRIMARY_VALUES.includes(o.value));

const BRIEFING_KEY = "mato-work-briefing-seen";

/**
 * localStorage verandert hier niet buiten deze component om, dus er valt niets
 * te abonneren. Moet wel buiten de component staan: een nieuwe functie per
 * render zou `useSyncExternalStore` elke keer opnieuw laten abonneren.
 */
const subscribeToNothing = () => () => {};

const DEFAULT_QUESTIONS = [
  "Welke producten wilt u onbemand beschikbaar maken?",
  "Hoe ziet restocking er praktisch uit?",
  "Denkt u eerder aan aankoop of huur?",
];

export function WorkMode({
  initialTriageLeads,
  initialCallLeads,
  clearedToday,
}: {
  initialTriageLeads: WorkLead[];
  initialCallLeads: WorkLead[];
  clearedToday: number;
}) {
  const [step, setStep] = useState<Step>(
    initialTriageLeads.length ? "review" : "call"
  );
  const [triageQueue, setTriageQueue] = useState(initialTriageLeads);
  const [callQueue, setCallQueue] = useState(initialCallLeads);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const [showMoreOutcomes, setShowMoreOutcomes] = useState(false);
  /**
   * Of de uitleg al eens gezien is, staat in localStorage — iets wat de server
   * niet kan weten.
   *
   * Via `useSyncExternalStore` met een aparte serversnapshot: die rendert "al
   * gezien", en na het hydrateren schakelt React over op de echte waarde. Dat
   * tijdens het renderen zelf uitlezen leverde een hydratiefout op, omdat
   * server en client dan verschillende HTML opleverden.
   */
  const briefingSeen = useSyncExternalStore(
    subscribeToNothing,
    () => window.localStorage.getItem(BRIEFING_KEY) !== null,
    () => true
  );
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const showBriefing = !briefingSeen && !briefingDismissed;
  const [outcome, setOutcome] = useState<string>("NO_ANSWER");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");

  const currentTriage = triageQueue[0] ?? null;
  const currentCall = callQueue[0] ?? null;

  const dismissBriefing = () => {
    window.localStorage.setItem(BRIEFING_KEY, "1");
    setBriefingDismissed(true);
  };

  const refreshCallQueue = useCallback(async () => {
    const res = await fetch("/api/work/call-queue", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as WorkLead[];
    setCallQueue(data);
    return data;
  }, []);

  /** Triage decision on the lead currently on screen. */
  const decide = (choice: "contact" | "skip") => {
    if (!currentTriage) return;
    const lead = currentTriage;
    start(async () => {
      setMessage("");
      try {
        if (choice === "contact") {
          await contactLead(lead.id);
        } else {
          await skipLead(lead.id);
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Opslaan is niet gelukt");
        return;
      }
      setTriageQueue((prev) => prev.filter((l) => l.id !== lead.id));
      if (choice === "contact") {
        setMessage(`${lead.name} staat op de bellijst`);
        await refreshCallQueue();
      } else {
        setMessage(`${lead.name} overgeslagen · terug te vinden bij Leads`);
      }
    });
  };

  /** Drop the lead on the call card without dialling it. */
  const skipCurrentCall = () => {
    if (!currentCall) return;
    const lead = currentCall;
    start(async () => {
      try {
        await skipLead(lead.id);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Overslaan is niet gelukt");
        return;
      }
      setCallQueue((prev) => prev.filter((l) => l.id !== lead.id));
      setMessage(`${lead.name} overgeslagen`);
    });
  };

  const discovery = useMemo(() => {
    if (!currentCall?.discoveryQuestions) return [];
    try {
      const parsed = JSON.parse(currentCall.discoveryQuestions);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, [currentCall]);

  const card = step === "review" ? currentTriage : currentCall;

  /**
   * Zet de zaak die nu op je scherm staat op jouw naam.
   *
   * Claimen bij tonen en niet bij openen van de pagina: de wachtrij bevat
   * veertig leads, en die allemaal vastzetten zou de rest van het team veertig
   * zaken afpakken waar je nog niet eens naar gekeken hebt.
   *
   * Lukt de claim niet, dan was een collega net eerder — die lead verdwijnt uit
   * je wachtrij en de volgende schuift door.
   */
  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    void claimLead(card.id).then((claimed) => {
      if (cancelled || claimed) return;
      const dropped = card.id;
      setTriageQueue((prev) => prev.filter((l) => l.id !== dropped));
      setCallQueue((prev) => prev.filter((l) => l.id !== dropped));
    });
    return () => {
      cancelled = true;
    };
  }, [card]);

  const why =
    card?.evidenceSummary ||
    card?.reason ||
    "Lokale voedingszaak — geschikt voor onbemande verkoop.";

  const opener =
    card?.phoneOpener ||
    "Goedemiddag, hier is MATO. Ik bel over een mogelijke verkoopautomaat.";

  /**
   * De invalshoek volgt het sterkste signaal dat deze zaak heeft.
   *
   * Volgorde is niet willekeurig: een bestaande automaat is een gesprek over
   * uitbreiden, de buren zijn een gesprek over achterstand, en afhaal is een
   * gesprek over wat ze al doen. Wie met de zwakste opening begint, krijgt de
   * sterkste nooit meer op tafel.
   */
  const angle =
    card?.recommendedAngle ||
    (card?.hasVending
      ? "Ze hebben al een automaat — vraag wat werkt, wat niet, en of een tweede of een vervanging zinvol is."
      : card?.nearbyVending
        ? `In de buurt staan er al ${card.nearbyVending} — vraag of ze klanten zien uitwijken naar wie 's avonds nog open is.`
        : card?.sellsTakeaway
          ? "Ze verkopen al afhaal — dezelfde producten blijven met een automaat ook na sluitingstijd verkopen."
          : "Producten langer beschikbaar zonder extra bemand punt.");

  const machine = card?.recommendedMachine || "Bepaal de automaat tijdens het gesprek";

  const objection = card?.likelyObjection || "Te duur / geen plaats";

  return (
    <div className="work-stage space-y-5 anim-lock">
      {showBriefing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(10,8,6,0.55)] backdrop-blur-sm p-4">
          <section className="panel p-6 sm:p-8 max-w-lg w-full space-y-5">
            <p className="label">Zo werkt het</p>
            <h2 className="display text-3xl font-semibold">Selecteren → Bellen → Noteren</h2>
            <ol className="space-y-3 text-sm text-[var(--text-dim)]">
              <li>
                <strong className="text-[var(--text)]">Selecteren</strong> — Bel deze
                zaak of sla hem over.
              </li>
              <li>
                <strong className="text-[var(--text)]">Bellen</strong> — Bel met het
                script op je scherm.
              </li>
              <li>
                <strong className="text-[var(--text)]">Noteren</strong> — Noteer het
                resultaat. De volgende lead verschijnt vanzelf.
              </li>
            </ol>
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={dismissBriefing}
            >
              Beginnen
            </button>
          </section>
        </div>
      )}

      <div className="mission-strip">
        <span>
          Te selecteren <strong>{triageQueue.length}</strong>
        </span>
        <span>
          Klaar om te bellen <strong>{callQueue.length}</strong>
        </span>
        <span>
          Gebeld vandaag <strong>{clearedToday}</strong>
        </span>
        <span className="ml-auto text-[var(--text-mute)]">Jij kiest wie je belt</span>
      </div>

      <div>
        <p className="label">Werk</p>
        <h1 className="display text-3xl sm:text-4xl font-semibold mt-1">
          Eén lead tegelijk.
        </h1>
        <p className="text-[var(--text-dim)] mt-2 max-w-xl">
          Werk de actieve stap af. De rest kan wachten.
        </p>
      </div>

      <div className="step-rail">
        {WORK_STEPS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="step-rail-item text-left"
            data-active={step === item.id}
            data-done={
              (item.id === "review" && step !== "review") ||
              (item.id === "call" && step === "log")
            }
            onClick={() => setStep(item.id as Step)}
          >
            <span className="step-rail-num">{item.code}</span>
            {item.label}
          </button>
        ))}
      </div>

      {message && (
        <p className="mono text-xs text-[var(--accent)] border border-[var(--border)] px-3 py-2">
          {message}
        </p>
      )}

      {step === "review" && (
        <section className="panel p-5 sm:p-7 space-y-5 anim-card flex-1">
          {!currentTriage ? (
            <EmptyState
              title="Niets te selecteren"
              body="Je hebt over elke gevonden zaak beslist. Zoek een nieuwe zone bij Leads, of begin met bellen."
              actionLabel={callQueue.length ? "Naar Bellen" : "Leads zoeken"}
              onAction={callQueue.length ? () => setStep("call") : undefined}
              href={callQueue.length ? undefined : "/leads"}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label">De moeite waard?</p>
                  <h2 className="display text-2xl sm:text-3xl font-semibold mt-1">
                    {currentTriage.name}
                  </h2>
                  <p className="text-sm text-[var(--text-dim)] mt-2">
                    {[currentTriage.address, currentTriage.city]
                      .filter(Boolean)
                      .join(" · ") || "Geen adres bekend"}
                  </p>
                </div>
                <div className="text-right mono text-xs text-[var(--text-dim)] space-y-1">
                  <div>{categoryLabel(currentTriage.category)}</div>
                  <div className="score text-base">{currentTriage.score}</div>
                  {currentTriage.hasVending && (
                    <div className="badge badge-live">Heeft automaat</div>
                  )}
                  {!currentTriage.hasVending && currentTriage.nearbyVending > 0 && (
                    <div className="badge">
                      {currentTriage.nearbyVending} in de buurt
                    </div>
                  )}
                  {currentTriage.sellsTakeaway && (
                    <div className="badge">Afhaal</div>
                  )}
                  {!currentTriage.phone && (
                    <div className="text-[var(--warn)]">geen nummer</div>
                  )}
                </div>
              </div>

              {currentTriage.hasVending && currentTriage.vendingDetail && (
                <p className="text-sm text-[var(--accent)] border border-[var(--accent-dim)] px-3 py-2">
                  {currentTriage.vendingDetail} — bewezen koper, vraag naar
                  vervanging of een tweede automaat.
                </p>
              )}

              {!currentTriage.hasVending && currentTriage.nearbyVending > 0 && (
                <p className="text-sm text-[var(--accent)] border border-[var(--accent-dim)] px-3 py-2">
                  {currentTriage.nearbyVending === 1
                    ? "Eén automaat binnen 1,5 km"
                    : `${currentTriage.nearbyVending} automaten binnen 1,5 km`}{" "}
                  — de buren zijn al om, deze zaak nog niet.
                </p>
              )}

              <p className="text-base sm:text-lg leading-relaxed max-w-2xl">{why}</p>

              <div className="space-y-1">
                <div className="telemetry-row">
                  <span>Telefoon</span>
                  <span>{currentTriage.phone ?? "niet bekend"}</span>
                </div>
                {currentTriage.website && (
                  <div className="telemetry-row">
                    <span>Website</span>
                    <a
                      href={currentTriage.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)]"
                    >
                      Openen
                    </a>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-xl"
                  disabled={pending}
                  onClick={() => decide("contact")}
                >
                  Bellen
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xl"
                  disabled={pending}
                  onClick={() => decide("skip")}
                >
                  Overslaan
                </button>
                <Link href={`/leads/${currentTriage.id}`} className="btn btn-ghost">
                  Bedrijfsfiche
                </Link>
              </div>
            </>
          )}
        </section>
      )}

      {step === "call" && (
        <section className="panel p-5 sm:p-7 space-y-6 anim-card flex-1">
          {!currentCall ? (
            <EmptyState
              title="Geen belafspraken"
              body="Kies eerst zaken bij Selecteren. Ze verschijnen hier met een belscript."
              actionLabel={triageQueue.length ? "Terug naar Selecteren" : "Leads zoeken"}
              onAction={triageQueue.length ? () => setStep("review") : undefined}
              href={triageQueue.length ? undefined : "/leads"}
            />
          ) : (
            <>
              <div className="text-center space-y-2">
                <p className="label">Nu bellen</p>
                <h2 className="display text-3xl font-semibold">{currentCall.name}</h2>
                <p className="text-sm text-[var(--text-dim)]">
                  {[currentCall.address, currentCall.city].filter(Boolean).join(" · ")}
                </p>
                {currentCall.hasVending && (
                  <span className="badge badge-live">Heeft automaat</span>
                )}
              </div>

              {currentCall.phone ? (
                <a href={`tel:${currentCall.phone}`} className="dial-orb">
                  <div className="text-center px-4">
                    <div className="label mb-2">Bellen</div>
                    <div className="display text-xl font-semibold">
                      {currentCall.phone}
                    </div>
                  </div>
                </a>
              ) : (
                <div className="dial-orb opacity-50">
                  <span className="label">Geen telefoonnummer</span>
                </div>
              )}

              <div className="space-y-3 max-w-2xl mx-auto w-full">
                {currentCall.hasVending && currentCall.vendingDetail && (
                  <PlainBlock title="Heeft al een automaat" body={currentCall.vendingDetail} />
                )}
                <PlainBlock title="Openingszin" body={opener} />
                <PlainBlock title="Invalshoek" body={angle} />
                <PlainBlock title="Automaat" body={machine} />
                <div>
                  <p className="label mb-2">Wat je vraagt</p>
                  <ul className="space-y-2 text-sm text-[var(--text-dim)]">
                    {(discovery.length ? discovery : DEFAULT_QUESTIONS).map((q) => (
                      <li key={q} className="border border-[var(--border)] px-3 py-2">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
                <PlainBlock title="Verwacht bezwaar" body={objection} />
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-xl"
                  onClick={() => setStep("log")}
                >
                  Resultaat noteren
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={skipCurrentCall}
                >
                  Nu overslaan
                </button>
                <Link href={`/leads/${currentCall.id}`} className="btn btn-ghost">
                  Bedrijfsfiche
                </Link>
              </div>
            </>
          )}
        </section>
      )}

      {step === "log" && currentCall && (
        <section className="panel p-5 sm:p-7 space-y-5 anim-card flex-1 max-w-2xl mx-auto w-full">
          <div>
            <p className="label">Resultaat noteren</p>
            <h2 className="display text-2xl font-semibold mt-1">{currentCall.name}</h2>
          </div>

          <form
            action="/api/work/log-call"
            method="post"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const res = await fetch("/api/work/log-call", {
                  method: "POST",
                  body: fd,
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setMessage(data.error || "Gesprek noteren is niet gelukt");
                  return;
                }
                setCallQueue((prev) => prev.filter((l) => l.id !== currentCall.id));
                setOutcome("NO_ANSWER");
                setNote("");
                setCallbackAt("");
                setMessage("Opgeslagen");
                const next = await refreshCallQueue();
                if (next?.length) setStep("call");
                else if (triageQueue.length) setStep("review");
                else setStep("call");
              });
            }}
          >
            <input type="hidden" name="leadId" value={currentCall.id} />
            <input type="hidden" name="outcome" value={outcome} />
            <input type="hidden" name="nextLeadId" value={callQueue[1]?.id || ""} />

            <div className="grid grid-cols-2 gap-2">
              {PRIMARY_OUTCOMES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={
                    outcome === item.value ? "btn btn-primary" : "btn btn-ghost"
                  }
                  onClick={() => setOutcome(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowMoreOutcomes((v) => !v)}
            >
              Meer resultaten
            </button>
            {showMoreOutcomes && (
              <div className="flex flex-wrap gap-2">
                {MORE_OUTCOMES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={
                      outcome === item.value ? "btn btn-primary" : "btn btn-ghost"
                    }
                    onClick={() => setOutcome(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {outcome === "CALLBACK" && (
              <input
                className="input"
                type="datetime-local"
                name="callbackAt"
                value={callbackAt}
                onChange={(e) => setCallbackAt(e.target.value)}
              />
            )}
            <textarea
              className="textarea"
              name="note"
              placeholder="Notitie (optioneel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary btn-xl w-full"
              disabled={pending}
            >
              Opslaan en volgende
            </button>
          </form>
        </section>
      )}

      {step === "log" && !currentCall && (
        <EmptyState
          title="Niets te noteren"
          body="Kies eerst een gesprek."
          actionLabel="Naar Bellen"
          onAction={() => setStep("call")}
        />
      )}
    </div>
  );
}

function PlainBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-[var(--border)] p-3">
      <p className="label mb-1">{title}</p>
      <p className="text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  href,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}) {
  return (
    <div className="text-center space-y-3 py-10">
      <h3 className="display text-2xl font-semibold">{title}</h3>
      <p className="text-sm text-[var(--text-dim)] max-w-md mx-auto">{body}</p>
      {actionLabel && href && (
        <Link href={href} className="btn btn-primary">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
