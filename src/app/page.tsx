import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { leadBotFetch } from "@/lib/lead-bot";
import { dealTotal, formatEUR, TASK_ACTIVE_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const CALLABLE_STATUSES = ["NEW", "TO_CALL", "FOLLOW_UP", "CONTACTED"];

export default async function CommandCenterPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const staleCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const soonCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const callableWhere = {
    doNotContact: false,
    complianceStatus: "CLEARED",
    status: { in: CALLABLE_STATUSES },
  };

  const [
    openDeals,
    wonRecent,
    callsToday,
    readyCount,
    overdueFollowUps,
    overdueCount,
    hotLeads,
    quotesOpen,
    meetingsToday,
    openTasks,
    overdueTasks,
    recentOutreach,
    recentLeads,
    reviewQueue,
    sourcingOpen,
    creativesAwaiting,
    docsAwaiting,
  ] = await Promise.all([
    prisma.deal.findMany({
      where: { stage: { notIn: ["WON", "LOST"] } },
      include: {
        lines: true,
        lead: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
    prisma.deal.findMany({
      where: { stage: "WON", wonAt: { gte: sixMonthsAgo } },
      include: { lines: true },
    }),
    prisma.outreachEvent.count({
      where: { createdAt: { gte: startOfDay }, type: "CALL" },
    }),
    prisma.lead.count({
      where: {
        ...callableWhere,
        OR: [{ nextActionAt: { lte: now } }, { nextActionAt: null }],
      },
    }),
    prisma.lead.findMany({
      where: { ...callableWhere, nextActionAt: { lt: startOfDay } },
      orderBy: { nextActionAt: "asc" },
      take: 6,
      select: { id: true, name: true, city: true, phone: true, score: true, nextActionAt: true },
    }),
    prisma.lead.count({
      where: { ...callableWhere, nextActionAt: { lt: startOfDay } },
    }),
    prisma.lead.findMany({
      where: { ...callableWhere, OR: [{ nextActionAt: { lte: now } }, { nextActionAt: null }] },
      orderBy: [{ score: "desc" }, { timingScore: "desc" }],
      take: 6,
      select: {
        id: true,
        name: true,
        city: true,
        phone: true,
        score: true,
        tier: true,
        recommendedMachine: true,
      },
    }),
    prisma.quote.findMany({
      where: { status: { in: ["REVIEW", "APPROVED", "SENT"] } },
      orderBy: { updatedAt: "desc" },
      include: {
        lead: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
    prisma.meeting.findMany({
      where: { startsAt: { gte: startOfDay, lt: endOfDay }, status: "SCHEDULED" },
      orderBy: { startsAt: "asc" },
      include: {
        lead: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
    prisma.task.findMany({
      where: { status: { in: [...TASK_ACTIVE_STATUSES] } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, title: true, dueAt: true, priority: true },
    }),
    prisma.task.count({
      where: { status: { in: [...TASK_ACTIVE_STATUSES] }, dueAt: { lt: now } },
    }),
    prisma.outreachEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { lead: { select: { id: true, name: true } } },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, city: true, score: true, tier: true, createdAt: true },
    }),
    fetchReviewCount(),
    prisma.sourcingRequest.count({
      where: { status: { notIn: ["DELIVERED", "CLOSED", "CANCELLED"] } },
    }),
    prisma.creativeRequest.count({
      where: { status: { in: ["INTERNAL_REVIEW", "CUSTOMER_REVIEW"] } },
    }),
    prisma.generatedDocument.count({
      where: { status: { in: ["DRAFT", "VALIDATED"] } },
    }),
  ]);

  const pipelineValue = openDeals.reduce(
    (s, d) => s + dealTotal(d.lines, d.discountPercent),
    0
  );
  const weightedPipeline = openDeals.reduce(
    (s, d) => s + dealTotal(d.lines, d.discountPercent) * (d.probability / 100),
    0
  );
  const wonThisMonth = wonRecent
    .filter((d) => d.wonAt && d.wonAt >= startOfMonth)
    .reduce((s, d) => s + dealTotal(d.lines, d.discountPercent), 0);

  const stageOrder = ["QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const;
  const byStage = stageOrder.map((stage) => {
    const deals = openDeals.filter((d) => d.stage === stage);
    return {
      stage,
      count: deals.length,
      value: deals.reduce((s, d) => s + dealTotal(d.lines, d.discountPercent), 0),
    };
  });
  const maxStageValue = Math.max(1, ...byStage.map((s) => s.value));

  const stalledDeals = openDeals
    .filter((d) => (d.lastActivityAt ?? d.updatedAt) < staleCutoff)
    .sort(
      (a, b) =>
        (a.lastActivityAt ?? a.updatedAt).getTime() -
        (b.lastActivityAt ?? b.updatedAt).getTime()
    )
    .slice(0, 5);

  const months: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const value = wonRecent
      .filter((d) => d.wonAt && d.wonAt >= monthStart && d.wonAt < monthEnd)
      .reduce((s, d) => s + dealTotal(d.lines, d.discountPercent), 0);
    months.push({
      label: monthStart.toLocaleDateString("nl-BE", { month: "short" }),
      value,
    });
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.value));

  const quotesExpiring = quotesOpen.filter(
    (q) => q.validUntil && q.validUntil <= soonCutoff
  );
  const sortedTasks = [...openTasks].sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return b.priority - a.priority;
  });

  const dateLine = now.toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Channel 00 · {dateLine}</p>
          <h1 className="display text-3xl sm:text-4xl font-semibold mt-1">
            Command Center
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {user.name} · everything that makes money today, on one screen
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge hidden sm:inline-flex">Ctrl K · search</span>
          <Link href="/work" className="btn btn-primary btn-xl armed">
            Enter work mode →
          </Link>
        </div>
      </div>

      <div className="mission-strip">
        <span>
          Ready to call <strong>{readyCount}</strong>
        </span>
        <span>
          Review queue{" "}
          <strong>{reviewQueue === null ? "offline" : reviewQueue}</strong>
        </span>
        <span>
          Overdue follow-ups <strong>{overdueCount}</strong>
        </span>
        <span>
          Calls logged today <strong>{callsToday}</strong>
        </span>
        <span>
          Sourcing open <strong>{sourcingOpen}</strong>
        </span>
        <span className={creativesAwaiting > 0 ? "text-[var(--warn)]" : undefined}>
          Creatives to approve <strong>{creativesAwaiting}</strong>
        </span>
        <span className={docsAwaiting > 0 ? "text-[var(--warn)]" : undefined}>
          Documents to approve <strong>{docsAwaiting}</strong>
        </span>
        <span className="ml-auto text-[var(--accent)]">signal active</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Open pipeline" value={formatEUR(pipelineValue)} sub={`${openDeals.length} open deals`} href="/deals" />
        <Metric label="Weighted pipeline" value={formatEUR(weightedPipeline)} sub="probability adjusted" href="/deals" />
        <Metric label="Won this month" value={formatEUR(wonThisMonth)} sub={monthLabel(now)} href="/sales" />
        <Metric
          label="Quotes in play"
          value={String(quotesOpen.length)}
          sub={quotesExpiring.length > 0 ? `${quotesExpiring.length} expiring < 7d` : "none expiring soon"}
          href="/quotes"
          warn={quotesExpiring.length > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="label text-[var(--accent)]">Next calls · highest value first</h2>
            <Link href="/calls" className="label hover:text-[var(--accent)]">
              all →
            </Link>
          </header>
          {hotLeads.length === 0 ? (
            <Empty text="Call queue is clear. Run a zone scan in Leads." />
          ) : (
            <ul className="space-y-2">
              {hotLeads.map((lead) => (
                <li key={lead.id} className="queue-row">
                  <div className="min-w-0">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="block truncate text-sm hover:text-[var(--accent)]"
                    >
                      {lead.name}
                    </Link>
                    <span className="text-xs text-[var(--text-dim)]">
                      {lead.city ?? "—"}
                      {lead.recommendedMachine ? ` · ${lead.recommendedMachine}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="score">{lead.score}</span>
                    {lead.phone ? (
                      <a className="btn py-1 min-h-0" href={`tel:${lead.phone}`}>
                        Call
                      </a>
                    ) : (
                      <span className="badge">no tel</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-4 space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="label text-[var(--accent)]">Overdue follow-ups</h2>
            <span className={`badge ${overdueCount > 0 ? "text-[var(--warn)] border-[var(--warn)]" : ""}`}>
              {overdueCount}
            </span>
          </header>
          {overdueFollowUps.length === 0 ? (
            <Empty text="Nothing overdue. Promises kept." />
          ) : (
            <ul className="space-y-2">
              {overdueFollowUps.map((lead) => (
                <li key={lead.id} className="queue-row">
                  <div className="min-w-0">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="block truncate text-sm hover:text-[var(--accent)]"
                    >
                      {lead.name}
                    </Link>
                    <span className="text-xs text-[var(--warn)]">
                      due {lead.nextActionAt?.toLocaleDateString("nl-BE") ?? "—"}
                      {lead.city ? ` · ${lead.city}` : ""}
                    </span>
                  </div>
                  {lead.phone ? (
                    <a className="btn py-1 min-h-0 shrink-0" href={`tel:${lead.phone}`}>
                      Call
                    </a>
                  ) : (
                    <span className="score shrink-0">{lead.score}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-4 space-y-3">
          <h2 className="label text-[var(--accent)]">Today</h2>
          <div className="space-y-2">
            <p className="label">Meetings</p>
            {meetingsToday.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">No meetings scheduled.</p>
            ) : (
              <ul className="space-y-1">
                {meetingsToday.map((m) => (
                  <li key={m.id} className="text-sm flex justify-between gap-2">
                    <span className="truncate">
                      {m.title}
                      <span className="text-[var(--text-dim)]">
                        {" "}
                        · {m.customer?.name ?? m.lead?.name ?? ""}
                      </span>
                    </span>
                    <span className="mono text-xs shrink-0">
                      {m.startsAt.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <p className="label flex items-center justify-between">
              <Link href="/tasks" className="hover:text-[var(--accent)]">
                Tasks{" "}
                {overdueTasks > 0 && (
                  <span className="text-[var(--warn)]">· {overdueTasks} overdue</span>
                )}
              </Link>
              <Link href="/tasks" className="hover:text-[var(--accent)]">
                all →
              </Link>
            </p>
            {sortedTasks.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">No open tasks.</p>
            ) : (
              <ul className="space-y-1">
                {sortedTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="text-sm flex justify-between gap-2">
                    <span className="truncate">{t.title}</span>
                    <span
                      className={`mono text-xs shrink-0 ${
                        t.dueAt && t.dueAt < now ? "text-[var(--warn)]" : "text-[var(--text-dim)]"
                      }`}
                    >
                      {t.dueAt ? t.dueAt.toLocaleDateString("nl-BE") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {quotesExpiring.length > 0 && (
            <div className="space-y-2">
              <p className="label text-[var(--warn)]">Quotes expiring</p>
              <ul className="space-y-1">
                {quotesExpiring.slice(0, 4).map((q) => (
                  <li key={q.id} className="text-sm flex justify-between gap-2">
                    <Link href="/quotes" className="truncate hover:text-[var(--accent)]">
                      {q.number} · {q.customer?.name ?? q.lead?.name ?? "—"}
                    </Link>
                    <span className="mono text-xs text-[var(--warn)] shrink-0">
                      {q.validUntil?.toLocaleDateString("nl-BE")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="label text-[var(--accent)]">Pipeline by stage</h2>
            <Link href="/deals" className="label hover:text-[var(--accent)]">
              deals →
            </Link>
          </header>
          <ul className="space-y-3">
            {byStage.map((s) => (
              <li key={s.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="mono text-xs tracking-wider">{s.stage}</span>
                  <span>
                    <span className="text-[var(--text-dim)]">{s.count} · </span>
                    <span className="score">{formatEUR(s.value)}</span>
                  </span>
                </div>
                <div className="h-2 border border-[var(--border)]">
                  <div
                    className="h-full bg-[var(--accent)] opacity-70"
                    style={{ width: `${Math.round((s.value / maxStageValue) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {stalledDeals.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="label text-[var(--warn)]">Stalled &gt; 14 days</p>
              <ul className="space-y-1">
                {stalledDeals.map((d) => (
                  <li key={d.id} className="text-sm flex justify-between gap-2">
                    <Link href="/deals" className="truncate hover:text-[var(--accent)]">
                      {d.title}
                      <span className="text-[var(--text-dim)]">
                        {" "}
                        · {d.customer?.name ?? d.lead?.name ?? "—"}
                      </span>
                    </Link>
                    <span className="mono text-xs text-[var(--text-dim)] shrink-0">
                      {(d.lastActivityAt ?? d.updatedAt).toLocaleDateString("nl-BE")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel p-4 space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="label text-[var(--accent)]">Won revenue · last 6 months</h2>
            <Link href="/sales" className="label hover:text-[var(--accent)]">
              reports →
            </Link>
          </header>
          <div className="flex items-end gap-2 h-36">
            {months.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="mono text-[0.6rem] text-[var(--text-dim)]">
                  {m.value > 0 ? formatEUR(m.value) : ""}
                </span>
                <div
                  className="w-full bg-[var(--accent)] opacity-70 border border-[var(--accent-dim)]"
                  style={{
                    height: `${Math.max(m.value > 0 ? 6 : 2, Math.round((m.value / maxMonth) * 100))}%`,
                  }}
                />
                <span className="mono text-[0.65rem] text-[var(--text-dim)] uppercase">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="label text-[var(--accent)]">Freshest leads</h2>
            <Link href="/leads" className="label hover:text-[var(--accent)]">
              leads →
            </Link>
          </header>
          <ul className="space-y-2">
            {recentLeads.map((lead) => (
              <li key={lead.id} className="queue-row">
                <div className="min-w-0">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="block truncate text-sm hover:text-[var(--accent)]"
                  >
                    {lead.name}
                  </Link>
                  <span className="text-xs text-[var(--text-dim)]">
                    {lead.city ?? "—"} · {lead.createdAt.toLocaleDateString("nl-BE")}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lead.tier && <span className="badge badge-live">{lead.tier}</span>}
                  <span className="score">{lead.score}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-4 space-y-3">
          <h2 className="label text-[var(--accent)]">Recent activity</h2>
          {recentOutreach.length === 0 ? (
            <Empty text="No outreach logged yet. First call of the day sets the tone." />
          ) : (
            <ul className="space-y-2">
              {recentOutreach.map((event) => (
                <li key={event.id} className="queue-row">
                  <div className="min-w-0">
                    <Link
                      href={`/leads/${event.lead.id}`}
                      className="block truncate text-sm hover:text-[var(--accent)]"
                    >
                      {event.lead.name}
                    </Link>
                    <span className="text-xs text-[var(--text-dim)]">
                      {event.type}
                      {event.outcome ? ` · ${event.outcome}` : ""}
                    </span>
                  </div>
                  <span className="mono text-xs text-[var(--text-dim)] shrink-0">
                    {event.createdAt.toLocaleDateString("nl-BE")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  href,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link href={href} className="panel p-4 block hover:border-[var(--accent-dim)] transition-colors">
      <div className="label">{label}</div>
      <div className="text-2xl mono mt-2">{value}</div>
      {sub && (
        <div className={`text-xs mt-1 ${warn ? "text-[var(--warn)]" : "text-[var(--text-dim)]"}`}>
          {sub}
        </div>
      )}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[var(--text-dim)]">{text}</p>;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("nl-BE", { month: "long" });
}

async function fetchReviewCount(): Promise<number | null> {
  try {
    const response = await leadBotFetch("/review/leads?min_tier=B&limit=100");
    if (!response.ok) return null;
    const leads = (await response.json()) as unknown[];
    return leads.length;
  } catch {
    return null;
  }
}
