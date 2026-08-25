"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { contactLead, skipLead } from "@/lib/actions";

export type TriageLead = {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  phone: string | null;
  website: string | null;
  score: number;
  reason: string | null;
  hasVending: boolean;
  nearbyVending: number;
};

export function TriageInbox({ initialLeads }: { initialLeads: TriageLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const current = leads[0] ?? null;

  function decide(action: (id: string) => Promise<void>) {
    if (!current) return;
    setError("");
    startTransition(async () => {
      try {
        await action(current.id);
        setLeads((queue) => queue.slice(1));
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Beslissing opslaan mislukt"
        );
      }
    });
  }

  if (!current) {
    return (
      <section className="panel p-8 text-center space-y-3">
        <h2 className="text-xl font-semibold">Inbox leeg</h2>
        <p className="text-sm text-[var(--text-dim)]">
          Alle gescande leads zijn beoordeeld.
        </p>
        <Link href="/leads" className="btn">
          Naar alle leads
        </Link>
      </section>
    );
  }

  return (
    <section className="panel p-5 sm:p-8 max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label text-[var(--accent)]">
            {leads.length} nog te beoordelen
          </p>
          <h2 className="text-2xl font-semibold mt-1">{current.name}</h2>
          <p className="text-sm text-[var(--text-dim)]">
            {[current.category, current.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="score text-3xl">{current.score}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label="Waarom gevonden" value={current.reason} />
        <Fact
          label="Automatensignaal"
          value={
            current.hasVending
              ? "Heeft al een automaat"
              : current.nearbyVending > 0
                ? `${current.nearbyVending} automaten in de buurt`
                : "Geen signaal"
          }
        />
        <Fact label="Telefoon" value={current.phone} />
        <Fact label="Website" value={current.website} />
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() => decide(contactLead)}
        >
          Interessant
        </button>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => decide(skipLead)}
        >
          Skip
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending || leads.length < 2}
          onClick={() =>
            setLeads((queue) => [...queue.slice(1), queue[0]])
          }
        >
          Volgende
        </button>
        <Link href={`/leads/${current.id}`} className="btn btn-ghost">
          Bekijk fiche
        </Link>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] p-3">
      <p className="label">{label}</p>
      <p className="text-sm mt-2">{value || "—"}</p>
    </div>
  );
}
