"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { claimLead } from "@/lib/actions";
import { CALL_OUTCOMES, LOSS_REASONS } from "@/lib/constants";

export type CallQueueLead = {
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
  status: string;
  outreach: Array<{
    note: string | null;
    type: string;
    outcome: string | null;
    createdAt: string;
  }>;
};

export function CallMode({ initialLeads }: { initialLeads: CallQueueLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [outcome, setOutcome] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const current = leads[0] ?? null;

  useEffect(() => {
    if (!current) return;
    let active = true;
    claimLead(current.id)
      .then((claimed) => {
        if (active && !claimed) {
          setLeads((queue) => queue.filter((lead) => lead.id !== current.id));
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Claimen is niet gelukt"
          );
        }
      });
    return () => {
      active = false;
    };
  }, [current]);

  async function refreshQueue() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/work/call-queue", {
        cache: "no-store",
      });
      const data = (await response.json()) as CallQueueLead[] | { error?: string };
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(
          Array.isArray(data) ? "Wachtrij laden mislukt" : data.error
        );
      }
      setLeads(data);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Wachtrij laden mislukt"
      );
    } finally {
      setPending(false);
    }
  }

  async function logCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("leadId", current.id);
    data.set("nextLeadId", leads[1]?.id ?? "");

    try {
      const response = await fetch("/api/work/log-call", {
        method: "POST",
        body: data,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Opslaan mislukt");
      setLeads((queue) => queue.slice(1));
      setOutcome("");
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Opslaan mislukt");
    } finally {
      setPending(false);
    }
  }

  if (!current) {
    return (
      <section className="panel p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Wachtrij afgewerkt</h2>
        <p className="text-sm text-[var(--text-dim)]">
          Er staat nu geen goedgekeurde lead klaar die vandaag gebeld moet worden.
        </p>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button
          type="button"
          className="btn btn-primary"
          onClick={refreshQueue}
          disabled={pending}
        >
          {pending ? "Laden…" : "Wachtrij verversen"}
        </button>
      </section>
    );
  }

  const last = current.outreach[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label text-[var(--accent)]">
              Nog {leads.length} in deze wachtrij
            </p>
            <h2 className="text-2xl font-semibold mt-1">{current.name}</h2>
            <p className="text-sm text-[var(--text-dim)]">
              {[current.address, current.city, current.category]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="score text-3xl">{current.score}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {current.phone ? (
            <a href={`tel:${current.phone}`} className="btn btn-primary">
              Bel {current.phone}
            </a>
          ) : (
            <span className="btn" aria-disabled="true">
              Geen telefoon
            </span>
          )}
          {current.website ? (
            <a
              href={current.website}
              className="btn"
              target="_blank"
              rel="noreferrer"
            >
              Website
            </a>
          ) : null}
          <Link href={`/leads/${current.id}`} className="btn">
            Volledige fiche
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setLeads((queue) =>
                queue.length > 1 ? [...queue.slice(1), queue[0]] : queue
              )
            }
          >
            Volgende zonder log
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Pitch label="Openingszin" value={current.phoneOpener} />
          <Pitch
            label="Producthint"
            value={current.recommendedMachine ?? current.recommendedAngle}
          />
          <Pitch label="Vragen" value={current.discoveryQuestions} />
          <Pitch label="Verwacht bezwaar" value={current.likelyObjection} />
        </div>

        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="label">Laatste notitie</p>
          <p className="text-sm mt-2 whitespace-pre-wrap">
            {last?.note || "Nog geen notitie."}
          </p>
          {last ? (
            <p className="text-xs text-[var(--text-dim)] mt-2">
              {new Date(last.createdAt).toLocaleDateString("nl-BE")} ·{" "}
              {last.type}
              {last.outcome ? ` · ${last.outcome}` : ""}
            </p>
          ) : null}
        </div>
      </section>

      <form onSubmit={logCall} className="panel p-4 space-y-3 self-start">
        <h2 className="label text-[var(--accent)]">Gesprek afronden</h2>
        <div>
          <label className="label block mb-1">Resultaat</label>
          <select
            name="outcome"
            className="select"
            required
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="" disabled>
              Kies…
            </option>
            {CALL_OUTCOMES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {outcome === "NOT_INTERESTED" ? (
          <div>
            <label className="label block mb-1">Verliesreden</label>
            <select name="lossReason" className="select" required defaultValue="">
              <option value="" disabled>
                Kies…
              </option>
              {LOSS_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="label block mb-1">Notitie</label>
          <textarea
            name="note"
            className="textarea"
            rows={4}
            placeholder="Kort wat er gezegd of beslist is"
          />
        </div>
        <div>
          <label className="label block mb-1">Volgende actie</label>
          <input name="callbackAt" type="datetime-local" className="input" />
        </div>
        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={pending}
        >
          {pending ? "Opslaan…" : "Opslaan en volgende"}
        </button>
      </form>
    </div>
  );
}

function Pitch({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] p-3">
      <p className="label">{label}</p>
      <p className="text-sm mt-2 whitespace-pre-wrap">
        {value || "Nog niet voorbereid."}
      </p>
    </div>
  );
}
