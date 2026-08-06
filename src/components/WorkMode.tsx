"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { WORK_STEPS } from "@/lib/constants";
import type { Lead } from "@/components/ReviewBoard";

type Step = "review" | "call" | "log";

type LeadDetail = Lead & {
  evidence?: Array<{
    field: string;
    value: string;
    source_url?: string;
    source_text?: string;
  }>;
  outreach_prep?: {
    one_sentence_reason?: string;
    sales_angle?: string;
    phone_opener?: string;
    discovery_questions?: string[];
    likely_objection?: string;
    objection_answer?: string;
  };
};

type CrmLead = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  phoneOpener: string | null;
  recommendedAngle: string | null;
  recommendedMachine: string | null;
  discoveryQuestions: string | null;
  likelyObjection: string | null;
  evidenceSummary: string | null;
  intelligenceEstablishmentId: string | null;
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

export function WorkMode({
  initialReviewLeads,
  initialCallLeads,
  clearedToday,
}: {
  initialReviewLeads: Lead[];
  initialCallLeads: CrmLead[];
  clearedToday: number;
}) {
  const [step, setStep] = useState<Step>("review");
  const [reviewQueue, setReviewQueue] = useState(initialReviewLeads);
  const [callQueue, setCallQueue] = useState(initialCallLeads);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showMoreOutcomes, setShowMoreOutcomes] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [outcome, setOutcome] = useState("NO_ANSWER");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");

  const currentReview = reviewQueue[0] ?? null;
  const currentCall = callQueue[0] ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(BRIEFING_KEY)) setShowBriefing(true);
  }, []);

  useEffect(() => {
    if (!currentReview) {
      setDetail(null);
      if (callQueue.length && step === "review") setStep("call");
      return;
    }
    let cancelled = false;
    setDetail(null);
    fetch(`/api/review/leads/${currentReview.establishment_id}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load lead");
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) =>
        setMessage(err instanceof Error ? err.message : "Failed to load lead")
      );
    return () => {
      cancelled = true;
    };
  }, [currentReview?.establishment_id, callQueue.length, step]);

  const dismissBriefing = () => {
    window.localStorage.setItem(BRIEFING_KEY, "1");
    setShowBriefing(false);
  };

  const refreshCallQueue = useCallback(async () => {
    const res = await fetch("/api/work/call-queue", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as CrmLead[];
    setCallQueue(data);
    return data;
  }, []);

  const act = (action: string) => {
    if (!currentReview) return;
    start(async () => {
      setMessage("");
      const res = await fetch(`/api/review/leads/${currentReview.establishment_id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload: {} }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || data.detail || "Action failed");
        return;
      }
      setReviewQueue((prev) =>
        prev.filter((l) => l.establishment_id !== currentReview.establishment_id)
      );
      if (action === "approve_for_call") {
        const nextCalls = await refreshCallQueue();
        setStep("call");
        if (!nextCalls?.length) {
          setMessage("Approved. Waiting for CRM sync — open Calls if needed.");
        }
      } else {
        setMessage(action === "reject_temporary" || action === "reject_permanent" ? "Rejected · next lead" : "Skipped · next lead");
      }
    });
  };

  const discovery = useMemo(() => {
    if (!currentCall?.discoveryQuestions) return detail?.outreach_prep?.discovery_questions || [];
    try {
      const parsed = JSON.parse(currentCall.discoveryQuestions);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, [currentCall, detail]);

  const why =
    detail?.why_this_company ||
    detail?.ranking_explanation ||
    currentReview?.why_this_company ||
    currentReview?.ranking_explanation ||
    detail?.why_contact_now ||
    detail?.outreach_prep?.one_sentence_reason ||
    currentCall?.evidenceSummary ||
    "This company matches MATO local bakery / food fit.";

  const opener =
    currentCall?.phoneOpener ||
    detail?.outreach_prep?.phone_opener ||
    `Goedemiddag, hier is MATO. Ik bel over een mogelijke verkoopautomaat.`;

  const angle =
    detail?.what_to_say ||
    currentCall?.recommendedAngle ||
    detail?.recommended_contact_angle ||
    detail?.outreach_prep?.sales_angle ||
    "Extend product availability without a second staffed outlet.";

  const machine =
    currentCall?.recommendedMachine || detail?.recommended_machine || "Recommended machine pending";

  const objection =
    currentCall?.likelyObjection ||
    detail?.outreach_prep?.likely_objection ||
    "Te duur / geen ruimte";

  return (
    <div className="work-stage space-y-5 anim-lock">
      {showBriefing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(3,5,7,0.88)] backdrop-blur-sm p-4">
          <section className="panel p-6 sm:p-8 max-w-lg w-full space-y-5">
            <p className="label text-[var(--accent)]">Mission briefing</p>
            <h2 className="display text-3xl font-semibold">Review → Call → Log</h2>
            <ol className="space-y-3 text-sm text-[var(--text-dim)]">
              <li><strong className="text-[var(--text)]">01 Review</strong> — Approve or reject the next company.</li>
              <li><strong className="text-[var(--text)]">02 Call</strong> — Dial with the script on screen.</li>
              <li><strong className="text-[var(--text)]">03 Log</strong> — Record the result. Next lead loads automatically.</li>
            </ol>
            <button type="button" className="btn btn-primary w-full armed" onClick={dismissBriefing}>
              Begin work
            </button>
          </section>
        </div>
      )}

      <div className="mission-strip">
        <span>
          Queue <strong>{reviewQueue.length}</strong> review
        </span>
        <span>
          Ready <strong>{callQueue.length}</strong> call
        </span>
        <span>
          Cleared today <strong>{clearedToday}</strong>
        </span>
        <span className="ml-auto text-[var(--text-mute)]">Human approval only</span>
      </div>

      <div>
        <p className="label text-[var(--accent)]">Work mode</p>
        <h1 className="display text-3xl sm:text-4xl font-semibold mt-1">One lead. One job.</h1>
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
          {!currentReview ? (
            <EmptyState
              title="Review queue clear"
              body="No leads waiting for human review. Switch to Call if approved leads are ready."
              actionLabel={callQueue.length ? "Go to Call" : undefined}
              onAction={callQueue.length ? () => setStep("call") : undefined}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label">Why this company</p>
                  <h2 className="display text-2xl sm:text-3xl font-semibold mt-1">
                    {detail?.establishment_name || currentReview.establishment_name || currentReview.company_name}
                  </h2>
                  <p className="text-sm text-[var(--text-dim)] mt-2">
                    {[detail?.address || currentReview.address, detail?.municipality || currentReview.municipality]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="text-right mono text-xs text-[var(--text-dim)] space-y-1">
                  <div>{detail?.category_label || currentReview.category_label || "Local"}</div>
                  {detail?.insufficient_data && <div className="text-[var(--warn)]">Needs more data</div>}
                  {typeof detail?.expected_margin_eur === "number" && (
                    <div className="text-[var(--accent)]">
                      EV €{Math.round(detail.expected_margin_eur)}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-base sm:text-lg leading-relaxed max-w-2xl">{why}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <PlainBlock title="What to say" body={angle} />
                <PlainBlock title="Machine fit" body={machine} />
              </div>

              {(detail?.social_profiles?.length || detail?.website || detail?.telephone) && (
                <div className="space-y-1">
                  {detail.telephone && (
                    <div className="telemetry-row">
                      <span>Phone</span>
                      <span>{detail.telephone}</span>
                    </div>
                  )}
                  {detail.website && (
                    <div className="telemetry-row">
                      <span>Website</span>
                      <a href={detail.website} target="_blank" rel="noreferrer" className="text-[var(--accent)]">
                        Open
                      </a>
                    </div>
                  )}
                  {(detail.social_profiles || []).slice(0, 4).map((p) => (
                    <div className="telemetry-row" key={p.url}>
                      <span>{p.platform}</span>
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-[var(--accent)]">
                        Profile
                      </a>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-xl armed"
                  disabled={pending}
                  onClick={() => act("approve_for_call")}
                >
                  Approve for call
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() => act("reject_temporary")}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={pending}
                  onClick={() => act("reject_permanent")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowMoreActions((v) => !v)}
                >
                  More actions
                </button>
              </div>

              {showMoreActions && (
                <div className="flex flex-wrap gap-1">
                  {[
                    "approve_for_email",
                    "request_research",
                    "do_not_contact",
                    "mark_duplicate",
                    "mark_existing_customer",
                  ].map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="btn btn-ghost"
                      disabled={pending}
                      onClick={() => act(id)}
                    >
                      {id.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {step === "call" && (
        <section className="panel p-5 sm:p-7 space-y-6 anim-card flex-1">
          {!currentCall ? (
            <EmptyState
              title="No cleared calls"
              body="Approve a lead in Review first. Cleared companies appear here with a phone script."
              actionLabel="Back to Review"
              onAction={() => setStep("review")}
            />
          ) : (
            <>
              <div className="text-center space-y-2">
                <p className="label">Call now</p>
                <h2 className="display text-3xl font-semibold">{currentCall.name}</h2>
                <p className="text-sm text-[var(--text-dim)]">
                  {[currentCall.address, currentCall.city].filter(Boolean).join(" · ")}
                </p>
              </div>

              {currentCall.phone ? (
                <a href={`tel:${currentCall.phone}`} className="dial-orb block">
                  <div className="text-center px-4">
                    <div className="label text-[var(--accent)] mb-2">Dial</div>
                    <div className="display text-xl font-semibold">{currentCall.phone}</div>
                  </div>
                </a>
              ) : (
                <div className="dial-orb opacity-50">
                  <span className="label">No phone</span>
                </div>
              )}

              <div className="space-y-3 max-w-2xl mx-auto w-full">
                <PlainBlock title="Opener" body={opener} />
                <PlainBlock title="Angle" body={angle} />
                <PlainBlock title="Machine" body={machine} />
                <div>
                  <p className="label mb-2">What to ask</p>
                  <ul className="space-y-2 text-sm text-[var(--text-dim)]">
                    {(discovery.length
                      ? discovery
                      : [
                          "Welke producten wilt u onbemand beschikbaar maken?",
                          "Hoe ziet restocking er praktisch uit?",
                          "Denkt u eerder aan aankoop of huur?",
                        ]
                    ).map((q) => (
                      <li key={q} className="border border-[var(--border)] px-3 py-2">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
                <PlainBlock title="Likely objection" body={objection} />
              </div>

              <div className="flex justify-center gap-2">
                <button type="button" className="btn btn-primary btn-xl armed" onClick={() => setStep("log")}>
                  Log result
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
              const form = e.currentTarget;
              const fd = new FormData(form);
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
                if (data.nextLeadId) {
                  setStep("call");
                  await refreshCallQueue();
                } else if (reviewQueue.length) {
                  setStep("review");
                } else {
                  setStep("call");
                  await refreshCallQueue();
                }
              });
            }}
          >
            <input type="hidden" name="leadId" value={currentCall.id} />
            <input type="hidden" name="outcome" value={outcome} />
            <input
              type="hidden"
              name="nextLeadId"
              value={callQueue[1]?.id || ""}
            />

            <div className="grid grid-cols-2 gap-2">
              {PRIMARY_OUTCOMES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={outcome === item.value ? "btn btn-primary" : "btn btn-ghost"}
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
                    className={outcome === item.value ? "btn btn-primary" : "btn btn-ghost"}
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
            <button type="submit" className="btn btn-primary btn-xl w-full armed" disabled={pending}>
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
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid place-items-center text-center py-16 space-y-3">
      <h2 className="display text-2xl font-semibold">{title}</h2>
      <p className="text-sm text-[var(--text-dim)] max-w-md">{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
