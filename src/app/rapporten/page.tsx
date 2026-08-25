import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { SHOP_DIKSMUIDE } from "@/lib/constants";
import {
  averageCycleDays,
  conversionDisplay,
  countBy,
} from "@/lib/reporting";

export const dynamic = "force-dynamic";

const PERIODS = [30, 90, 180, 365] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ dagen?: string }>;
}) {
  const viewer = await requirePageUser(["admin", "sales", "reviewer"]);
  const params = await searchParams;
  const requested = Number(params.dagen);
  const days = PERIODS.includes(requested as (typeof PERIODS)[number])
    ? requested
    : 90;
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const in60 = new Date(now.getTime() + 60 * 86_400_000);

  const [
    outreach,
    meetings,
    wonDeals,
    dealAudits,
    lostDeals,
    leadCohort,
    shopPlacements,
    settings,
    users,
  ] = await Promise.all([
    prisma.outreachEvent.findMany({
      where: { createdAt: { gte: since } },
      select: {
        type: true,
        leadId: true,
        createdById: true,
      },
    }),
    prisma.meeting.findMany({
      where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      select: { id: true },
    }),
    prisma.deal.findMany({
      where: { wonAt: { gte: since } },
      select: {
        id: true,
        createdAt: true,
        wonAt: true,
        wonValue: true,
        ownerId: true,
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        createdAt: { gte: since },
        action: {
          in: ["aios.voorstel_saved", "deal.created", "deal.updated"],
        },
      },
      select: { actorId: true, action: true, entityId: true, detail: true },
    }),
    prisma.deal.findMany({
      where: { stage: "LOST", updatedAt: { gte: since } },
      select: { lossReason: true },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        source: true,
        province: true,
        deals: { where: { stage: "WON" }, select: { id: true } },
      },
    }),
    prisma.machinePlacement.findMany({
      where: { site: SHOP_DIKSMUIDE.site },
      select: {
        id: true,
        status: true,
        shopSlot: true,
        contractEndsAt: true,
        placedAt: true,
        removedAt: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.appSettings.findUnique({
      where: { id: "default" },
      select: { shopCapacity: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const proposalKeys = new Set<string>();
  const proposalsByUser = new Map<string, Set<string>>();
  for (const event of dealAudits) {
    const detail = safeObject(event.detail);
    const isProposal =
      event.action === "aios.voorstel_saved" || detail.stage === "PROPOSAL";
    if (!isProposal) continue;
    const key =
      typeof detail.dealId === "string" ? detail.dealId : event.entityId;
    if (!key) continue;
    proposalKeys.add(key);
    if (event.actorId) {
      const keys = proposalsByUser.get(event.actorId) ?? new Set<string>();
      keys.add(key);
      proposalsByUser.set(event.actorId, keys);
    }
  }

  const calls = outreach.filter((event) => event.type === "CALL");
  const cycleDays = averageCycleDays(wonDeals);
  const lossReasons = countBy(lostDeals, (deal) => deal.lossReason);
  const sourceRows = cohortRows(leadCohort, (lead) => lead.source);
  const zoneRows = cohortRows(leadCohort, (lead) => lead.province);
  const capacity = Math.max(1, settings?.shopCapacity ?? 8);
  const activeShop = shopPlacements.filter(
    (placement) => placement.status === "ACTIVE"
  );
  const expiring30 = activeShop.filter(
    (placement) =>
      placement.contractEndsAt && placement.contractEndsAt <= in30
  );
  const expiring60 = activeShop.filter(
    (placement) =>
      placement.contractEndsAt &&
      placement.contractEndsAt > in30 &&
      placement.contractEndsAt <= in60
  );
  const started = shopPlacements.filter(
    (placement) => placement.placedAt >= since
  );
  const ended = shopPlacements.filter(
    (placement) => placement.removedAt && placement.removedAt >= since
  );
  const visibleUsers =
    viewer.role === "admin"
      ? users
      : users.filter((employee) => employee.id === viewer.id);
  const teamRows = visibleUsers.map((user) => {
    const activity = outreach.filter(
      (event) => event.createdById === user.id
    );
    const uniqueLeads = new Set(activity.map((event) => event.leadId)).size;
    const won = wonDeals.filter((deal) => deal.ownerId === user.id).length;
    return {
      ...user,
      activity: activity.length,
      calls: activity.filter((event) => event.type === "CALL").length,
      uniqueLeads,
      proposals: proposalsByUser.get(user.id)?.size ?? 0,
      won,
      conversion: conversionDisplay(won, uniqueLeads),
    };
  });

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="label">Rapportering</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            Verkoop en shop
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Geregistreerde activiteit van de voorbije {days} dagen. Kleine
            steekproeven krijgen bewust geen conversiepercentage.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Rapportperiode">
          {PERIODS.map((period) => (
            <Link
              key={period}
              href={`/rapporten?dagen=${period}`}
              className={period === days ? "btn btn-primary btn-sm" : "btn btn-sm"}
            >
              {period}d
            </Link>
          ))}
        </nav>
      </div>

      <section className="space-y-3">
        <h2 className="label text-[var(--accent)]">Verkoopfunnel</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Figure label="Gesprekken" value={calls.length} />
          <Figure label="Afspraken geboekt" value={meetings.length} />
          <Figure label="Voorstellen bewaard" value={proposalKeys.size} />
          <Figure label="Gewonnen deals" value={wonDeals.length} />
          <Figure
            label="Gem. doorlooptijd"
            value={cycleDays == null ? "—" : `${Math.round(cycleDays)} d`}
          />
        </div>
        <p className="text-xs text-[var(--text-dim)]">
          Definities: gesprekken = gelogde calls; afspraken = niet-geannuleerde
          afspraken aangemaakt in de periode; voorstellen = unieke bewaarde
          voorstellen; doorlooptijd = deal aangemaakt tot gewonnen.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Breakdown
          title="Verliesredenen"
          rows={lossReasons.map((row) => ({
            label: row.label,
            value: String(row.count),
          }))}
          empty="Nog geen verloren deals met reden in deze periode."
        />
        <Cohort title="Bronvergelijking" rows={sourceRows} />
        <Cohort title="Zonevergelijking" rows={zoneRows} />
      </section>

      <section className="space-y-3">
        <h2 className="label text-[var(--accent)]">Automatenshop Diksmuide</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Figure label="Bezetting" value={`${activeShop.length} / ${capacity}`} />
          <Figure
            label="Bezettingsgraad"
            value={`${Math.round((activeShop.length / capacity) * 100)}%`}
          />
          <Figure label="Einde binnen 30d" value={expiring30.length} />
          <Figure label="Einde 31–60d" value={expiring60.length} />
          <Figure
            label="Plaatswissels"
            value={`${started.length} in · ${ended.length} uit`}
          />
        </div>
        {(expiring30.length || expiring60.length) > 0 ? (
          <div className="panel p-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {[...expiring30, ...expiring60].map((placement) => (
                <li key={placement.id}>
                  <Link
                    href={`/shop/${placement.customer.id}`}
                    className="hover:text-[var(--accent)]"
                  >
                    {placement.customer.name}
                  </Link>
                  <span className="text-xs text-[var(--text-dim)] block">
                    Plaats {placement.shopSlot ?? "—"} ·{" "}
                    {placement.contractEndsAt?.toLocaleDateString("nl-BE")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="label text-[var(--accent)]">
            {viewer.role === "admin" ? "Teamcontext" : "Jouw context"}
          </h2>
          {viewer.role === "admin" ? (
            <Link href="/team" className="text-sm text-[var(--accent)]">
              Commissie en kosten →
            </Link>
          ) : null}
        </div>
        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Medewerker</th>
                <th>Activiteiten</th>
                <th>Calls</th>
                <th>Unieke leads</th>
                <th>Voorstellen</th>
                <th>Gewonnen</th>
                <th>Conversie</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {viewer.role === "admin" ? (
                      <Link
                        href={`/team/${row.id}`}
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{row.name}</span>
                    )}
                  </td>
                  <td>{row.activity}</td>
                  <td>{row.calls}</td>
                  <td>{row.uniqueLeads}</td>
                  <td>{row.proposals}</td>
                  <td>{row.won}</td>
                  <td>{row.conversion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--text-dim)]">
          Context voor coaching, niet voor rangschikking: bij minder dan 10
          unieke opgevolgde leads staat geen conversiepercentage.
        </p>
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-4">
      <p className="label">{label}</p>
      <p className="display text-2xl mt-1">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  empty: string;
}) {
  return (
    <section className="panel p-4">
      <h2 className="label text-[var(--accent)]">{title}</h2>
      {rows.length ? (
        <ul className="space-y-2 mt-3 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex justify-between gap-3">
              <span>{row.label}</span>
              <span className="mono">{row.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-dim)] mt-3">{empty}</p>
      )}
    </section>
  );
}

function Cohort({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; leads: number; won: number; conversion: string }>;
}) {
  return (
    <Breakdown
      title={title}
      rows={rows.map((row) => ({
        label: `${row.label} · ${row.leads} leads · ${row.won} gewonnen`,
        value: row.conversion,
      }))}
      empty="Nog geen leads in deze periode."
    />
  );
}

function cohortRows<T extends { deals: Array<{ id: string }> }>(
  rows: T[],
  key: (row: T) => string | null
) {
  const groups = new Map<string, { leads: number; won: number }>();
  for (const row of rows) {
    const label = key(row)?.trim() || "Onbekend";
    const group = groups.get(label) ?? { leads: 0, won: 0 };
    group.leads += 1;
    if (row.deals.length) group.won += 1;
    groups.set(label, group);
  }
  return [...groups.entries()]
    .map(([label, group]) => ({
      label,
      ...group,
      conversion: conversionDisplay(group.won, group.leads),
    }))
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
}

function safeObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
