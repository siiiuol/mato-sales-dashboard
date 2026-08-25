import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { Avatar } from "@/components/Avatar";
import { roleLabel } from "@/lib/constants";
import {
  totalCommission,
  euro,
  roi,
} from "@/lib/team-stats";
import { conversionDisplay } from "@/lib/reporting";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requirePageUser(["admin"]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [employees, outreach, wonDeals, shopRentals, proposalAudits] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.outreachEvent.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { createdById: true, leadId: true, type: true },
    }),
    prisma.deal.findMany({
      where: { ownerId: { not: null }, wonAt: { gte: monthStart } },
      select: { ownerId: true, wonValue: true },
    }),
    prisma.customer.groupBy({
      by: ["ownerId"],
      where: {
        kind: "SHOP_TENANT",
        ownerId: { not: null },
        createdAt: { gte: monthStart },
      },
      _count: { _all: true },
    }),
    prisma.auditEvent.findMany({
      where: {
        createdAt: { gte: monthStart },
        action: {
          in: ["aios.voorstel_saved", "deal.created", "deal.updated"],
        },
      },
      select: { actorId: true, entityId: true, action: true, detail: true },
    }),
  ]);

  const dealsBy = new Map<string, number[]>();
  for (const deal of wonDeals) {
    if (!deal.ownerId) continue;
    const list = dealsBy.get(deal.ownerId) ?? [];
    list.push(deal.wonValue ?? 0);
    dealsBy.set(deal.ownerId, list);
  }
  const rentalsBy = new Map(
    shopRentals.map((row) => [row.ownerId ?? "", row._count._all])
  );
  const proposalsBy = new Map<string, Set<string>>();
  for (const event of proposalAudits) {
    const detail = safeObject(event.detail);
    if (event.action !== "aios.voorstel_saved" && detail.stage !== "PROPOSAL") {
      continue;
    }
    if (!event.actorId) continue;
    const keys = proposalsBy.get(event.actorId) ?? new Set<string>();
    const key =
      typeof detail.dealId === "string" ? detail.dealId : event.entityId;
    if (!key) continue;
    keys.add(key);
    proposalsBy.set(event.actorId, keys);
  }

  const rows = employees.map((employee) => {
    const values = dealsBy.get(employee.id) ?? [];
    const rentals = rentalsBy.get(employee.id) ?? 0;
    const activity = outreach.filter(
      (event) => event.createdById === employee.id
    );
    const uniqueLeads = new Set(activity.map((event) => event.leadId)).size;
    const calls = activity.filter((event) => event.type === "CALL").length;
    const revenue = values.reduce((sum, value) => sum + value, 0);
    const commission = totalCommission(employee, values, rentals);
    return {
      employee,
      activity: activity.length,
      calls,
      uniqueLeads,
      proposals: proposalsBy.get(employee.id)?.size ?? 0,
      sales: values.length,
      rentals,
      revenue,
      commission,
      result: roi({ revenue, cost: employee.monthlyCost, commission }),
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.result.totalCost,
      calls: acc.calls + row.calls,
    }),
    { revenue: 0, cost: 0, calls: 0 }
  );

  const monthName = monthStart.toLocaleDateString("nl-BE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="label">Team</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            Medewerkers
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Cijfers van {monthName} · {employees.length}{" "}
            {employees.length === 1 ? "account" : "accounts"}
          </p>
        </div>
        <Link href="/team/new" className="btn btn-primary">
          Medewerker toevoegen
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Figure label="Omzet deze maand" value={euro(totals.revenue)} />
        <Figure label="Kost deze maand" value={euro(totals.cost)} />
        <Figure
          label="Gesprekken deze maand"
          value={String(totals.calls)}
          mono={false}
        />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <Link
            key={row.employee.id}
            href={`/team/${row.employee.id}`}
            className="panel p-4 space-y-4 block hover:border-[var(--accent-dim)] transition-colors"
          >
            <div className="flex items-start gap-3">
              <Avatar name={row.employee.name} photoUrl={row.employee.photoUrl} />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{row.employee.name}</div>
                <div className="text-xs text-[var(--text-dim)] truncate">
                  {row.employee.email}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="badge">{roleLabel(row.employee.role)}</span>
                  {!row.employee.active && (
                    <span className="badge">Uitgeschakeld</span>
                  )}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <Stat label="Gebeld" value={String(row.calls)} />
              <Stat label="Activiteiten" value={String(row.activity)} />
              <Stat label="Unieke leads" value={String(row.uniqueLeads)} />
              <Stat label="Voorstellen" value={String(row.proposals)} />
              <Stat label="Verkocht" value={String(row.sales)} />
              <Stat label="Huurcontracts" value={String(row.rentals)} />
              <Stat
                label="Conversie"
                value={conversionDisplay(row.sales, row.uniqueLeads)}
              />
              <Stat label="Omzet" value={euro(row.revenue)} />
            </dl>

            <div className="border-t border-[var(--border)] pt-3 text-xs text-[var(--text-dim)] space-y-1">
              <div className="flex justify-between gap-2">
                <span>Kost per maand</span>
                <span className="mono">{euro(row.employee.monthlyCost)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Commissie</span>
                <span className="mono">{euro(row.commission)}</span>
              </div>
              <div className="flex justify-between gap-2 font-medium text-[var(--text)]">
                <span>Resultaat</span>
                <span
                  className="mono"
                  style={{
                    color:
                      row.result.profit >= 0 ? "var(--ok)" : "var(--alert)",
                  }}
                >
                  {euro(row.result.profit)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-[var(--text-dim)]">
        Conversie gebruikt unieke opgevolgde leads. Onder 10 leads tonen we
        bewust geen percentage; activiteit is context voor coaching, geen
        rangschikking.
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div
        className={`text-2xl font-semibold mt-1 ${mono ? "mono" : "display"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mono mt-0.5">{value}</dd>
    </div>
  );
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
