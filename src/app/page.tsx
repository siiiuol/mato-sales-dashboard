import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { releaseLead, takeLead } from "@/lib/actions";
import { OwnerButton } from "@/components/OwnerButton";
import {
  LEAD_STATUSES,
  SHOP_DIKSMUIDE,
  categoryLabel,
  contactTypeLabel,
  outcomeLabel,
  statusLabel,
} from "@/lib/constants";
import { euro } from "@/lib/team-stats";
import { TaskStrip } from "@/components/TaskStrip";
import {
  isLeadStale,
  OPEN_LEAD_STATUSES,
  shopFreeSlots,
  utcDayBounds,
} from "@/lib/today-dashboard";
import { groupTasksByDueDate, TASK_SELECT } from "@/lib/tasks";
import { summarizeLeadQuality } from "@/lib/data-quality";

export const dynamic = "force-dynamic";

/**
 * Statussen waaraan nog gewerkt wordt. Gewonnen en afgehaakte zaken zakken naar
 * beneden — ze horen wel in je overzicht te blijven staan, maar niet bovenaan
 * je werklijst.
 */
const OPEN_STATUSES: readonly string[] = OPEN_LEAD_STATUSES;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const sp = await searchParams;

  const [myLeads, tasks, settings, shopPlacements, qualityLeads] =
    await Promise.all([
      prisma.lead.findMany({
        where: { ownerId: user.id },
        orderBy: [
          { nextActionAt: "asc" },
          { score: "desc" },
          { ownedAt: "desc" },
        ],
        select: {
          id: true,
          name: true,
          city: true,
          category: true,
          phone: true,
          score: true,
          status: true,
          nextActionAt: true,
          lastTouchedAt: true,
          createdAt: true,
          ownedAt: true,
          hasVending: true,
          nearbyVending: true,
          outreach: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { type: true, outcome: true, createdAt: true, note: true },
          },
          deals: {
            where: { wonAt: { not: null } },
            select: { wonValue: true },
          },
        },
      }),
      prisma.task.findMany({
        where: { assignedToId: user.id, status: "OPEN" },
        orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
        take: 100,
        select: TASK_SELECT,
      }),
      prisma.appSettings.upsert({
        where: { id: "default" },
        update: {},
        create: { id: "default" },
        select: { shopCapacity: true },
      }),
      prisma.machinePlacement.findMany({
        where: { site: SHOP_DIKSMUIDE.site, status: "ACTIVE" },
        select: { shopSlot: true },
      }),
      prisma.lead.findMany({
        where: { status: { in: [...OPEN_LEAD_STATUSES] } },
        orderBy: { updatedAt: "desc" },
        take: 1000,
        select: {
          id: true,
          name: true,
          city: true,
          phone: true,
          email: true,
          website: true,
          lat: true,
          lng: true,
          status: true,
          ownerId: true,
          nextActionAt: true,
          lastTouchedAt: true,
          createdAt: true,
          complianceStatus: true,
        },
      }),
    ]);

  const leads = sp.status
    ? myLeads.filter((lead) => lead.status === sp.status)
    : myLeads;
  const open = leads.filter((l) => OPEN_STATUSES.includes(l.status));
  const closed = leads.filter((l) => !OPEN_STATUSES.includes(l.status));
  const revenue = myLeads.reduce(
    (sum, l) => sum + l.deals.reduce((s, d) => s + (d.wonValue ?? 0), 0),
    0
  );

  const now = new Date();
  const { start: startOfToday, end: startOfTomorrow } = utcDayBounds(now);
  const allOpen = myLeads.filter((lead) => OPEN_STATUSES.includes(lead.status));
  const overdue = allOpen.filter(
    (lead) => lead.nextActionAt && lead.nextActionAt < startOfToday
  );
  const dueToday = allOpen.filter(
    (lead) =>
      lead.nextActionAt &&
      lead.nextActionAt >= startOfToday &&
      lead.nextActionAt < startOfTomorrow
  );
  const stale = allOpen.filter((lead) => isLeadStale(lead, now));
  const taskGroups = groupTasksByDueDate(tasks, now);
  const quality = summarizeLeadQuality(qualityLeads, now);
  const freeShopSlots = shopFreeSlots(settings.shopCapacity, shopPlacements);

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="label">Vandaag</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            Waar u aan werkt
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {myLeads.length} op uw naam · {allOpen.length} open
            {overdue.length + dueToday.length > 0
              ? ` · ${overdue.length + dueToday.length} nu opvolgen`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/bellen" className="btn btn-primary btn-press">
            Start belmodus
          </Link>
          <Link href="/leads" className="btn">
            Meer leads
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <p className="label text-[var(--accent)]">Vandaag</p>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Wat eerst aandacht nodig heeft, zonder tussen schermen te zoeken.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <TodayCard
            label="Te laat"
            value={overdue.length}
            href="/leads?focus=overdue"
            names={overdue.slice(0, 3).map((lead) => lead.name)}
            urgent
          />
          <TodayCard
            label="Vandaag gepland"
            value={dueToday.length}
            href="/leads?focus=today"
            names={dueToday.slice(0, 3).map((lead) => lead.name)}
          />
          <TodayCard
            label="Open taken"
            value={taskGroups.overdue.length + taskGroups.today.length}
            href="/taken"
            names={[
              ...taskGroups.overdue,
              ...taskGroups.today,
            ]
              .slice(0, 3)
              .map((task) => task.title)}
            urgent={taskGroups.overdue.length > 0}
          />
          <TodayCard
            label="14+ dagen stil"
            value={stale.length}
            href="/leads?focus=stale"
            names={stale.slice(0, 3).map((lead) => lead.name)}
          />
          <TodayCard
            label="Nog beoordelen"
            value={quality.pendingTriage}
            href="/leads/triage"
            names={["Compliance-inbox"]}
          />
          <TodayCard
            label="Vrije shopplaatsen"
            value={freeShopSlots}
            href="/shop"
            names={["Showroom Diksmuide"]}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Figure label="Open" value={String(allOpen.length)} />
        <Figure
          label="Nu opvolgen"
          value={String(overdue.length + dueToday.length)}
        />
        <Figure label="Verkocht" value={euro(revenue)} />
      </section>

      <TaskStrip userId={user.id} />

      <details className="panel p-4 sm:p-5">
        <summary className="cursor-pointer">
          <span className="label text-[var(--accent)]">Datakwaliteit</span>
          <span className="text-sm text-[var(--text-dim)] ml-2">
            {quality.pendingTriage + quality.missingContact + quality.ownerless}{" "}
            aandachtspunten
          </span>
        </summary>
        <div className="mt-4">
          <DataQualityPanel quality={quality} />
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Link href="/" className={`badge ${!sp.status ? "badge-live" : ""}`}>
          alles
        </Link>
        {LEAD_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/?status=${status}`}
            className={`badge ${sp.status === status ? "badge-live" : ""}`}
          >
            {statusLabel(status)}
          </Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <section className="panel p-8 text-center space-y-3">
          <p className="text-[var(--text-dim)]">
            Je hebt nog geen leads op je naam staan.
          </p>
          <p className="text-sm text-[var(--text-dim)]">
            Zoek in de lijst een zaak die je wil opvolgen en druk op{" "}
            <strong>Aan mijn leads toevoegen</strong>. Vanaf dan is hij van jou en
            kan een collega hem niet meer oppakken.
          </p>
          <Link href="/leads" className="btn btn-primary">
            Naar de leadlijst
          </Link>
        </section>
      ) : (
        <>
          <LeadTable
            title={`Open · ${open.length}`}
            leads={open}
            userId={user.id}
            isAdmin={user.role === "admin"}
            now={now}
          />
          {closed.length > 0 && (
            <LeadTable
              title={`Afgerond · ${closed.length}`}
              leads={closed}
              userId={user.id}
              isAdmin={user.role === "admin"}
              now={now}
            />
          )}
        </>
      )}
    </div>
  );
}

type Row = {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  phone: string | null;
  score: number;
  status: string;
  nextActionAt: Date | null;
  hasVending: boolean;
  nearbyVending: number;
  outreach: Array<{
    type: string;
    outcome: string | null;
    createdAt: Date;
    note: string | null;
  }>;
  deals: Array<{ wonValue: number | null }>;
};

function LeadTable({
  title,
  leads,
  userId,
  isAdmin,
  now,
}: {
  title: string;
  leads: Row[];
  userId: string;
  isAdmin: boolean;
  now: Date;
}) {
  if (!leads.length) return null;

  return (
    <section className="panel p-4 overflow-x-auto">
      <h2 className="label text-[var(--accent)] mb-3">{title}</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Score</th>
            <th>Zaak</th>
            <th>Plaats</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const last = lead.outreach[0];
            const overdue = lead.nextActionAt && lead.nextActionAt <= now;
            return (
              <tr key={lead.id} className="anim-list-item">
                <td className="score">{lead.score}</td>
                <td>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {lead.name}
                  </Link>
                  <div className="text-xs text-[var(--text-dim)]">
                    {categoryLabel(lead.category)}
                    {last
                      ? ` · ${contactTypeLabel(last.type)}${
                          last.outcome ? ` — ${outcomeLabel(last.outcome)}` : ""
                        }`
                      : " · nog geen contact"}
                  </div>
                  {overdue && (
                    <span className="badge badge-live mt-1">Vandaag opvolgen</span>
                  )}
                </td>
                <td className="text-sm text-[var(--text-dim)]">
                  {lead.city ?? "—"}
                </td>
                <td>
                  <Link href={`/leads/${lead.id}`} className="btn btn-sm btn-press">
                    Openen
                  </Link>
                </td>
                <td>
                  <OwnerButton
                    leadId={lead.id}
                    ownerId={userId}
                    ownerName={null}
                    currentUserId={userId}
                    isAdmin={isAdmin}
                    takeAction={takeLead}
                    releaseAction={releaseLead}
                    compact
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function TodayCard({
  label,
  value,
  href,
  names,
  urgent = false,
}: {
  label: string;
  value: number;
  href: string;
  names: string[];
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="panel p-4 hover:border-[var(--accent)] transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="label">{label}</span>
        <span className={`mono text-2xl font-semibold ${urgent && value ? "text-[var(--danger)]" : ""}`}>
          {value}
        </span>
      </div>
      <p className="text-xs text-[var(--text-dim)] mt-3 line-clamp-2">
        {names.length ? names.join(" · ") : "Niets open"}
      </p>
    </Link>
  );
}

function DataQualityPanel({
  quality,
}: {
  quality: ReturnType<typeof summarizeLeadQuality>;
}) {
  const issues = [
    {
      label: "Zonder telefoon of e-mail",
      value: quality.missingContact,
      href: "/leads?focus=missing-contact",
    },
    {
      label: "Zonder eigenaar",
      value: quality.ownerless,
      href: "/leads?focus=ownerless",
    },
    {
      label: "Zonder volgende actie",
      value: quality.withoutNextAction,
      href: "/leads?focus=no-next",
    },
    {
      label: "Nog te beoordelen",
      value: quality.pendingTriage,
      href: "/leads?focus=triage",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-[var(--text-dim)]">
          Kleine gaten die opvolging of terugvinden vertragen.
        </p>
        <span className="badge">
          {quality.duplicatePairs.length} mogelijke dubbels
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {issues.map((issue) => (
          <Link
            key={issue.label}
            href={issue.href}
            className="rounded-lg border border-[var(--border)] p-3 hover:border-[var(--accent)]"
          >
            <span className="block mono text-xl font-semibold">{issue.value}</span>
            <span className="block text-xs text-[var(--text-dim)] mt-1">
              {issue.label}
            </span>
          </Link>
        ))}
      </div>
      {quality.duplicatePairs.length > 0 ? (
        <div className="text-xs text-[var(--text-dim)]">
          Mogelijke dubbels:{" "}
          {quality.duplicatePairs.slice(0, 3).map((pair, index) => (
            <span key={`${pair.first.id}-${pair.second.id}`}>
              {index > 0 ? " · " : ""}
              <Link
                href={`/leads/${pair.first.id}`}
                className="text-[var(--accent)] hover:underline"
              >
                {pair.first.name}
              </Link>
              {" / "}
              <Link
                href={`/leads/${pair.second.id}`}
                className="text-[var(--accent)] hover:underline"
              >
                {pair.second.name}
              </Link>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className="mono text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
