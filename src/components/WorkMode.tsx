"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { WORK_STEPS } from "@/lib/constants";
import { contactLead, skipLead } from "@/lib/actions";

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
  phoneOpener: string | null;
  recommendedAngle: string | null;
  recommendedMachine: string | null;
  discoveryQuestions: string | null;
  likelyObjection: string | null;
  evidenceSummary: string | null;
};

const PRIMARY_OUTCOMES = [
  { value: "NO_ANSWER", label: "No answer" },
  { value: "CALLBACK", label: "Callback" },
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not interested" },
] as const;

const MORE_OUTCOMES = [
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
] as const;

const BRIEFING_KEY = "mato-work-briefing-seen";

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
  const [showBriefing, setShowBriefing] = useState(
    () => typeof window !== "undefined" && !window.localStorage.getItem(BRIEFING_KEY)
  );
  const [outcome, setOutcome] = useState<string>("NO_ANSWER");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");

  const currentTriage = triageQueue[0] ?? null;
  const currentCall = callQueue[0] ?? null;

  const dismissBriefing = () => {
    window.localStorage.setItem(BRIEFING_KEY, "1");
    setShowBriefing(false);
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
        setMessage(err instanceof Error ? err.message : "Could not save that");
        return;
      }
      setTriageQueue((prev) => prev.filter((l) => l.id !== lead.id));
      if (choice === "contact") {
        setMessage(`${lead.name} added to the call list`);
        await refreshCallQueue();
      } else {
        setMessage(`${lead.name} skipped · find it again under Leads`);
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
        setMessage(err instanceof Error ? err.message : "Could not skip");
        return;
      }
      setCallQueue((prev) => prev.filter((l) => l.id !== lead.id));
      setMessage(`${lead.name} skipped`);
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

  const why =
    card?.evidenceSummary ||
    card?.reason ||
    "Local food business — a fit for unattended sales.";

  const opener =
    card?.phoneOpener ||
    "Goedemiddag, hier is MATO. Ik bel over een mogelijke verkoopautomaat.";

  const angle =
    card?.recommendedAngle ||
    (card?.hasVending
      ? "They already run a machine — ask what works, what does not, and whether a second one or a replacement makes sense."
      : "Extend product availability without a second staffed outlet.");

  const machine = card?.recommendedMachine || "Match the machine on the call";

  const objection = card?.likelyObjection || "Te duur / geen ruimte";

  return (
    <div className="work-stage space-y-5 anim-lock">
      {showBriefing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(3,5,7,0.88)] backdrop-blur-sm p-4">
          <section className="panel p-6 sm:p-8 max-w-lg w-full space-y-5">
            <p className="label text-[var(--accent)]">Mission briefing</p>
            <h2 className="display text-3xl font-semibold">Triage → Call → Log</h2>
            <ol className="space-y-3 text-sm text-[var(--text-dim)]">
              <li>
                <strong className="text-[var(--text)]">01 Triage</strong> — Contact
                or skip the next business.
              </li>
              <li>
                <strong className="text-[var(--text)]">02 Call</strong> — Dial with
                the script on screen.
              </li>
              <li>
                <strong className="text-[var(--text)]">03 Log</strong> — Record the
                result. The next lead loads automatically.
              </li>
            </ol>
            <button
              type="button"
              className="btn btn-primary w-full armed"
              onClick={dismissBriefing}
            >
              Begin work
            </button>
          </section>
        </div>
      )}

      <div className="mission-strip">
        <span>
          To triage <strong>{triageQueue.length}</strong>
        </span>
        <span>
          Ready to call <strong>{callQueue.length}</strong>
        </span>
        <span>
          Calls logged today <strong>{clearedToday}</strong>
        </span>
        <span className="ml-auto text-[var(--text-mute)]">You decide every call</span>
      </div>

      <div>
        <p className="label text-[var(--accent)]">Work mode</p>
        <h1 className="display text-3xl sm:text-4xl font-semibold mt-1">
          One lead. One job.
        </h1>
        <p className="text-[var(--text-dim)] mt-2 max-w-xl">
          Follow the active step. Everything else is secondary.
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
            {item.code} {item.label}
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
              title="Nothing to triage"
              body="Every business you found has been decided on. Search a new zone under Leads, or start calling."
              actionLabel={callQueue.length ? "Go to Call" : "Find leads"}
              onAction={callQueue.length ? () => setStep("call") : undefined}
              href={callQueue.length ? undefined : "/leads"}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label">Worth calling?</p>
                  <h2 className="display text-2xl sm:text-3xl font-semibold mt-1">
                    {currentTriage.name}
                  </h2>
                  <p className="text-sm text-[var(--text-dim)] mt-2">
                    {[currentTriage.address, currentTriage.city]
                      .filter(Boolean)
                      .join(" · ") || "No address on file"}
                  </p>
                </div>
                <div className="text-right mono text-xs text-[var(--text-dim)] space-y-1">
                  <div>{currentTriage.category ?? "Local"}</div>
                  <div className="score text-base">{currentTriage.score}</div>
                  {currentTriage.hasVending && (
                    <div className="badge badge-live">HAS VENDING</div>
                  )}
                  {!currentTriage.phone && (
                    <div className="text-[var(--warn)]">no phone</div>
                  )}
                </div>
              </div>

              {currentTriage.hasVending && currentTriage.vendingDetail && (
                <p className="text-sm text-[var(--accent)] border border-[var(--accent-dim)] px-3 py-2">
                  {currentTriage.vendingDetail} — proven buyer, ask about
                  replacement or a second machine.
                </p>
              )}

              <p className="text-base sm:text-lg leading-relaxed max-w-2xl">{why}</p>

              <div className="space-y-1">
                <div className="telemetry-row">
                  <span>Phone</span>
                  <span>{currentTriage.phone ?? "not in OpenStreetMap"}</span>
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
                      Open
                    </a>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-xl armed"
                  disabled={pending}
                  onClick={() => decide("contact")}
                >
                  Contact
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xl"
                  disabled={pending}
                  onClick={() => decide("skip")}
                >
                  Skip
                </button>
                <Link href={`/leads/${currentTriage.id}`} className="btn btn-ghost">
                  Company file
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
              title="No calls queued"
              body="Pick businesses to contact in Triage first. They appear here with a phone script."
              actionLabel={triageQueue.length ? "Back to Triage" : "Find leads"}
              onAction={triageQueue.length ? () => setStep("review") : undefined}
              href={triageQueue.length ? undefined : "/leads"}
            />
          ) : (
            <>
              <div className="text-center space-y-2">
                <p className="label">Call now</p>
                <h2 className="display text-3xl font-semibold">{currentCall.name}</h2>
                <p className="text-sm text-[var(--text-dim)]">
                  {[currentCall.address, currentCall.city].filter(Boolean).join(" · ")}
                </p>
                {currentCall.hasVending && (
                  <span className="badge badge-live">HAS VENDING</span>
                )}
              </div>

              {currentCall.phone ? (
                <a href={`tel:${currentCall.phone}`} className="dial-orb block">
                  <div className="text-center px-4">
                    <div className="label text-[var(--accent)] mb-2">Dial</div>
                    <div className="display text-xl font-semibold">
                      {currentCall.phone}
                    </div>
                  </div>
                </a>
              ) : (
                <div className="dial-orb opacity-50">
                  <span className="label">No phone on file</span>
                </div>
              )}

              <div className="space-y-3 max-w-2xl mx-auto w-full">
                {currentCall.hasVending && currentCall.vendingDetail && (
                  <PlainBlock title="Already vending" body={currentCall.vendingDetail} />
                )}
                <PlainBlock title="Opener" body={opener} />
                <PlainBlock title="Angle" body={angle} />
                <PlainBlock title="Machine" body={machine} />
                <div>
                  <p className="label mb-2">What to ask</p>
                  <ul className="space-y-2 text-sm text-[var(--text-dim)]">
                    {(discovery.length ? discovery : DEFAULT_QUESTIONS).map((q) => (
                      <li key={q} className="border border-[var(--border)] px-3 py-2">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
                <PlainBlock title="Likely objection" body={objection} />
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-xl armed"
                  onClick={() => setStep("log")}
                >
                  Log result
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={skipCurrentCall}
                >
                  Skip for now
                </button>
                <Link href={`/leads/${currentCall.id}`} className="btn btn-ghost">
                  Company file
                </Link>
              </div>
            </>
          )}
        </section>
      )}

      {step === "log" && currentCall && (
        <section className="panel p-5 sm:p-7 space-y-5 anim-card flex-1 max-w-2xl mx-auto w-full">
          <div>
            <p className="label">Log result</p>
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
                  setMessage(data.error || "Could not log call");
                  return;
                }
                setCallQueue((prev) => prev.filter((l) => l.id !== currentCall.id));
                setOutcome("NO_ANSWER");
                setNote("");
                setCallbackAt("");
                setMessage("Logged · next");
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
              More outcomes
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
              placeholder="Optional note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary btn-xl w-full armed"
              disabled={pending}
            >
              Save and advance
            </button>
          </form>
        </section>
      )}

      {step === "log" && !currentCall && (
        <EmptyState
          title="Nothing to log"
          body="Pick a call first."
          actionLabel="Go to Call"
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
