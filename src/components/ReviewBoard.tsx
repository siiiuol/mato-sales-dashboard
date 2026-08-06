"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

export type Lead = {
  establishment_id: number;
  company_name: string;
  establishment_name?: string;
  address?: string;
  municipality?: string;
  region?: string;
  segment?: string;
  category_label?: string;
  quality_score: number;
  confidence_score: number;
  timing_score: number;
  priority_score: number;
  expected_margin_eur?: number;
  ranking_explanation?: string;
  insufficient_data?: boolean;
  why_this_company?: string;
  what_to_say?: string;
  tier: string;
  recommended_machine?: string;
  alternative_machines?: string[];
  machine_reasons?: string[];
  top_positive_reasons?: string[];
  main_risks?: string[];
  why_contact_now?: string;
  recommended_contact_angle?: string;
  website?: string;
  telephone?: string;
  email?: string;
  social_profiles?: Array<{ platform: string; url: string }>;
  review_status?: string;
  lat?: number;
  lng?: number;
};

type LeadDetail = Lead & {
  evidence?: Array<{
    field: string;
    value: string;
    source_url?: string;
    source_text?: string;
    confidence?: number;
  }>;
  outreach_prep?: {
    one_sentence_reason?: string;
    sales_angle?: string;
    phone_opener?: string;
    discovery_questions?: string[];
    email_blurb?: string;
    likely_objection?: string;
    objection_answer?: string;
    best_channel?: string;
    next_action?: string;
  };
};

const CATEGORY_ORDER = [
  "Bakeries",
  "Butcheries / deli",
  "Traiteurs / meal prep",
  "Chocolatiers / sweets",
  "Other local",
  "Host locations",
];

const PRIMARY_ACTIONS = [
  { id: "approve_for_call", label: "Approve for call" },
  { id: "reject_temporary", label: "Skip" },
  { id: "reject_permanent", label: "Reject" },
] as const;

const MORE_ACTIONS = [
  { id: "approve_for_email", label: "Approve for email" },
  { id: "request_research", label: "More research" },
  { id: "do_not_contact", label: "Do not contact" },
  { id: "mark_duplicate", label: "Duplicate" },
  { id: "mark_existing_customer", label: "Existing customer" },
] as const;

export function ReviewBoard({
  initialLeads,
}: {
  initialLeads: Lead[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [loadingList, setLoadingList] = useState(initialLeads.length === 0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (initialLeads.length) return;
    fetch("/api/review/leads?min_tier=B&limit=80", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || data.detail || "Review API failed");
        setLeads(data);
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Lead bot unreachable")
      )
      .finally(() => setLoadingList(false));
  }, [initialLeads.length]);

  const groups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of leads) {
      const key = lead.category_label || "Other local";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lead);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          b.priority_score - a.priority_score ||
          b.quality_score - a.quality_score ||
          (a.establishment_name || a.company_name).localeCompare(
            b.establishment_name || b.company_name
          )
      );
    }
    const ordered: { category: string; leads: Lead[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const list = map.get(cat);
      if (list?.length) ordered.push({ category: cat, leads: list });
      map.delete(cat);
    }
    for (const [category, list] of map) {
      if (list.length) ordered.push({ category, leads: list });
    }
    return ordered;
  }, [leads]);

  async function openLead(id: number) {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/review/leads/${id}`, { cache: "no-store" });
      if (res.ok) {
        setDetail(await res.json());
      } else {
        const fallback = leads.find((l) => l.establishment_id === id) || null;
        setDetail(fallback);
      }
    } catch {
      setDetail(leads.find((l) => l.establishment_id === id) || null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function act(establishmentId: number, action: string) {
    start(async () => {
      const res = await fetch(`/api/review/leads/${establishmentId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload: {} }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.detail || "Action failed");
        return;
      }
      setMessage(
        `${action} · ${data.crm_export?.ok === false ? data.crm_export.error : "ok"}`
      );
      setLeads((prev) => prev.filter((l) => l.establishment_id !== establishmentId));
      if (selectedId === establishmentId) {
        setSelectedId(null);
        setDetail(null);
      }
    });
  }

  if (loadingList) {
    return <section className="panel p-6 mono anim-scan">Loading review queue…</section>;
  }

  if (leads.length === 0) {
    return (
      <section className="panel p-6 text-[var(--text-dim)]">
        No bakery/local leads waiting. Run{" "}
        <span className="mono text-[var(--text)]">
          python -m lead_bot.jobs.import_kbo --path data/kbo/latest.zip --region east_west_flanders
        </span>{" "}
        then{" "}
        <span className="mono text-[var(--text)]">python -m lead_bot.jobs.enrich_pipeline</span>{" "}
        and restart the lead bot.
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {message && <div className="label text-[var(--accent)]">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.category} className="panel overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="label text-[var(--accent)]">{group.category}</h2>
                <span className="mono text-xs text-[var(--text-dim)]">
                  {group.leads.length} · by score
                </span>
              </div>
              <ul>
                {group.leads.map((lead) => {
                  const active = selectedId === lead.establishment_id;
                  return (
                    <li key={lead.establishment_id}>
                      <button
                        type="button"
                        onClick={() => openLead(lead.establishment_id)}
                        className={`w-full text-left px-4 py-3 border-b border-[var(--border)] transition-colors ${
                          active
                            ? "bg-[rgba(57,255,138,0.1)] border-l-2 border-l-[var(--accent)]"
                            : "hover:bg-[rgba(57,255,138,0.04)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {lead.establishment_name || lead.company_name}
                            </div>
                            <div className="text-xs text-[var(--text-dim)] mt-0.5">
                              {lead.municipality || "—"} · {lead.tier}
                            </div>
                          </div>
                          <div className="score text-lg shrink-0">
                            {Math.round(lead.priority_score)}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <aside className="panel p-4 lg:sticky lg:top-20 h-fit min-h-[280px]">
          {!selectedId && (
            <p className="text-sm text-[var(--text-dim)]">
              Click a lead to see company information.
            </p>
          )}
          {selectedId && loadingDetail && (
            <p className="mono text-sm text-[var(--text-dim)] anim-scan">Loading…</p>
          )}
          {selectedId && !loadingDetail && detail && (
            <DetailPanel
              detail={detail}
              pending={pending}
              onAction={act}
              onClose={() => {
                setSelectedId(null);
                setDetail(null);
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailPanel({
  detail,
  pending,
  onAction,
  onClose,
}: {
  detail: LeadDetail;
  pending: boolean;
  onAction: (id: number, action: string) => void;
  onClose: () => void;
}) {
  const [showMoreActions, setShowMoreActions] = useState(false);
  const maps =
    detail.lat != null && detail.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${detail.lat},${detail.lng}`
      : detail.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.address)}`
        : null;

  return (
    <div className="space-y-4 anim-lock">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="label">
            {detail.category_label} · {detail.tier}
          </div>
          <h2 className="text-xl font-semibold mt-1">
            {detail.establishment_name || detail.company_name}
          </h2>
          <p className="text-sm text-[var(--text-dim)] mt-1">{detail.address}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <Metric label="Priority" value={detail.priority_score} />
        <Metric label="Quality" value={detail.quality_score} />
        <Metric label="Confidence" value={detail.confidence_score} />
        <Metric label="Timing" value={detail.timing_score} />
      </div>

      <div>
        <div className="label mb-1">Machine</div>
        <div className="mono text-[var(--accent)]">
          {detail.recommended_machine || "—"}
        </div>
        {!!detail.alternative_machines?.length && (
          <div className="text-xs text-[var(--text-dim)] mt-1">
            Alts: {detail.alternative_machines.join(", ")}
          </div>
        )}
        {!!detail.machine_reasons?.length && (
          <ul className="text-sm mt-2 space-y-1 text-[var(--text-dim)]">
            {detail.machine_reasons.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="label mb-1">Why this lead</div>
        <ul className="text-sm space-y-1">
          {(detail.top_positive_reasons || []).map((r) => (
            <li key={r}>+ {r}</li>
          ))}
        </ul>
        <p className="text-sm text-[var(--text-dim)] mt-2">{detail.why_contact_now}</p>
        {detail.recommended_contact_angle && (
          <p className="text-sm mt-2 border border-[var(--border)] p-2 bg-[rgba(0,0,0,0.25)]">
            {detail.recommended_contact_angle}
          </p>
        )}
      </div>

      <div>
        <div className="label mb-1">Risks</div>
        <ul className="text-sm text-[var(--warn)] space-y-1">
          {(detail.main_risks || []).length ? (
            detail.main_risks!.map((r) => <li key={r}>! {r}</li>)
          ) : (
            <li className="text-[var(--text-dim)]">None flagged</li>
          )}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        {detail.telephone && (
          <a className="btn btn-primary" href={`tel:${detail.telephone}`}>
            {detail.telephone}
          </a>
        )}
        {detail.website && (
          <a
            className="btn btn-ghost"
            href={detail.website}
            target="_blank"
            rel="noreferrer"
          >
            Website
          </a>
        )}
        {(detail.social_profiles || []).map((profile) => (
          <a
            key={`${profile.platform}-${profile.url}`}
            className="btn btn-ghost"
            href={profile.url}
            target="_blank"
            rel="noreferrer"
          >
            {profile.platform}
          </a>
        ))}
        {maps && (
          <a className="btn btn-ghost" href={maps} target="_blank" rel="noreferrer">
            Maps
          </a>
        )}
        {detail.email && (
          <span className="mono text-xs self-center text-[var(--text-dim)]">
            {detail.email}
          </span>
        )}
      </div>

      {detail.outreach_prep && (
        <div className="border border-[var(--border)] p-3 space-y-2">
          <div className="label text-[var(--accent)]">Outreach prep</div>
          {detail.outreach_prep.phone_opener && (
            <p className="text-sm">{detail.outreach_prep.phone_opener}</p>
          )}
          {!!detail.outreach_prep.discovery_questions?.length && (
            <ul className="text-sm text-[var(--text-dim)] space-y-1">
              {detail.outreach_prep.discovery_questions.map((q) => (
                <li key={q}>? {q}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!!detail.evidence?.length && (
        <div>
          <div className="label mb-2">Evidence</div>
          <ul className="space-y-2 max-h-40 overflow-y-auto text-xs">
            {detail.evidence.map((e, i) => (
              <li key={`${e.field}-${i}`} className="border border-[var(--border)] p-2">
                <span className="mono text-[var(--accent)]">{e.field}</span> = {e.value}
                {e.source_text && (
                  <div className="text-[var(--text-dim)] mt-1">“{e.source_text}”</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {PRIMARY_ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={pending}
            className={
              a.id === "approve_for_call"
                ? "btn btn-primary armed"
                : a.id === "reject_permanent"
                  ? "btn btn-danger"
                  : "btn btn-ghost"
            }
            onClick={() => onAction(detail.establishment_id, a.id)}
          >
            {a.label}
          </button>
        ))}
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
          {MORE_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={pending}
              className={
                a.id === "do_not_contact" ? "btn btn-danger" : "btn btn-ghost"
              }
              onClick={() => onAction(detail.establishment_id, a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--border)] p-2">
      <div className="label">{label}</div>
      <div className="score mt-1">{Math.round(value)}</div>
    </div>
  );
}
