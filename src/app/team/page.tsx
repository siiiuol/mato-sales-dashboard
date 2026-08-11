import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { Avatar } from "@/components/Avatar";
import { roleLabel } from "@/lib/constants";
import {
  commissionForDeals,
  euro,
  percent,
  rankByRevenue,
  roi,
  conversionRate,
} from "@/lib/team-stats";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requirePageUser(["admin"]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [employees, calls, wonDeals] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    // Eén keer groeperen in plaats van per medewerker een query — anders groeit
    // het aantal queries mee met het team.
    prisma.outreachEvent.groupBy({
      by: ["createdById"],
      where: { type: "CALL", createdAt: { gte: monthStart } },
      _count: { _all: true },
    }),
    prisma.deal.findMany({
      where: { ownerId: { not: null }, wonAt: { gte: monthStart } },
      select: { ownerId: true, wonValue: true },
    }),
  ]);

  const callsBy = new Map(
    calls.map((row) => [row.createdById ?? "", row._count._all])
  );
  const dealsBy = new Map<string, number[]>();
  for (const deal of wonDeals) {
    if (!deal.ownerId) continue;
    const list = dealsBy.get(deal.ownerId) ?? [];
    list.push(deal.wonValue ?? 0);
    dealsBy.set(deal.ownerId, list);
  }

  const rows = employees.map((employee) => {
    const values = dealsBy.get(employee.id) ?? [];
    const revenue = values.reduce((sum, value) => sum + value, 0);
    const commission = commissionForDeals(employee, values);
    return {
      employee,
      calls: callsBy.get(employee.id) ?? 0,
      sales: values.length,
      revenue,
      commission,
      result: roi({ revenue, cost: employee.monthlyCost, commission }),
    };
  });

  const ranked = rankByRevenue(rows);
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
        {ranked.map((row, index) => (
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
                  {index === 0 && row.revenue > 0 && (
                    <span className="badge badge-live">Beste deze maand</span>
                  )}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <Stat label="Gebeld" value={String(row.calls)} />
              <Stat label="Verkocht" value={String(row.sales)} />
              <Stat label="Omzet" value={euro(row.revenue)} />
              <Stat
                label="Scoort"
                value={percent(conversionRate(row.sales, row.calls))}
              />
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
