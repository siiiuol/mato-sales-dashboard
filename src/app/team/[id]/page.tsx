import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { setEmployeeActive } from "@/lib/employee-actions";
import { Avatar } from "@/components/Avatar";
import { DailyBars, DistributionBars } from "@/components/Charts";
import {
  CALL_OUTCOMES,
  COMMISSION_TYPE_LABELS,
  roleLabel,
  statusLabel,
} from "@/lib/constants";
import {
  bucketByDay,
  commissionForDeals,
  conversionRate,
  euro,
  percent,
  roi,
} from "@/lib/team-stats";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const DAYS = 30;

/** Uitkomsten die geld dichterbij of verderaf brengen, krijgen hun eigen kleur. */
const OUTCOME_TONE: Record<string, string> = {
  INTERESTED: "var(--ok)",
  NOT_INTERESTED: "var(--alert)",
  WRONG_NUMBER: "var(--alert)",
};

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const employee = await prisma.user.findUnique({ where: { id: parsed.data } });
  if (!employee) notFound();

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - (DAYS - 1));
  windowStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [calls, wonDeals, ownedLeads, recentLeads] = await Promise.all([
    prisma.outreachEvent.findMany({
      where: {
        createdById: employee.id,
        type: "CALL",
        createdAt: { gte: windowStart },
      },
      select: { createdAt: true, outcome: true },
    }),
    prisma.deal.findMany({
      where: { ownerId: employee.id, wonAt: { not: null } },
      orderBy: { wonAt: "desc" },
      select: {
        id: true,
        title: true,
        wonValue: true,
        wonAt: true,
        customer: { select: { name: true } },
        lead: { select: { id: true, name: true } },
      },
    }),
    prisma.lead.count({ where: { ownerId: employee.id } }),
    prisma.lead.findMany({
      where: { ownerId: employee.id },
      orderBy: { lastTouchedAt: "desc" },
      take: 8,
      select: { id: true, name: true, status: true, city: true, lastTouchedAt: true },
    }),
  ]);

  const buckets = bucketByDay(
    calls.map((call) => call.createdAt),
    DAYS,
    now
  );

  const outcomeRows = CALL_OUTCOMES.map((outcome) => ({
    label: outcome.label,
    count: calls.filter((call) => call.outcome === outcome.value).length,
    tone: OUTCOME_TONE[outcome.value],
  })).filter((row) => row.count > 0);

  const monthDeals = wonDeals.filter(
    (deal) => deal.wonAt && deal.wonAt >= monthStart
  );
  const monthValues = monthDeals.map((deal) => deal.wonValue ?? 0);
  const monthRevenue = monthValues.reduce((sum, value) => sum + value, 0);
  const monthCommission = commissionForDeals(employee, monthValues);
  const monthResult = roi({
    revenue: monthRevenue,
    cost: employee.monthlyCost,
    commission: monthCommission,
  });

  const allTimeRevenue = wonDeals.reduce(
    (sum, deal) => sum + (deal.wonValue ?? 0),
    0
  );
  const monthCalls = calls.filter((call) => call.createdAt >= monthStart).length;

  const commissionDescription =
    employee.commissionType === "FIXED"
      ? `${euro(employee.commissionValue)} per verkoop`
      : `${employee.commissionValue}% van de verkoop`;

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar name={employee.name} photoUrl={employee.photoUrl} size={64} />
          <div>
            <p className="label">Medewerker</p>
            <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
              {employee.name}
            </h1>
            <p className="text-sm text-[var(--text-dim)]">{employee.email}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="badge">{roleLabel(employee.role)}</span>
              {!employee.active && <span className="badge">Uitgeschakeld</span>}
              {employee.lastLoginAt && (
                <span className="badge">
                  Laatst aangemeld{" "}
                  {employee.lastLoginAt.toLocaleDateString("nl-BE")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <form action={setEmployeeActive}>
            <input type="hidden" name="userId" value={employee.id} />
            <input
              type="hidden"
              name="active"
              value={employee.active ? "false" : "true"}
            />
            <button className="btn btn-ghost">
              {employee.active ? "Uitschakelen" : "Weer inschakelen"}
            </button>
          </form>
          <Link href="/team" className="btn">
            Terug
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Omzet deze maand" value={euro(monthRevenue)} />
        <Figure
          label="Resultaat deze maand"
          value={euro(monthResult.profit)}
          tone={monthResult.profit >= 0 ? "var(--ok)" : "var(--alert)"}
        />
        <Figure label="Gebeld deze maand" value={String(monthCalls)} />
        <Figure
          label="Scoort"
          value={percent(conversionRate(monthDeals.length, monthCalls))}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2">
          <DailyBars buckets={buckets} label={`Gesprekken per dag · ${DAYS} dagen`} />
        </section>

        <section className="panel p-4">
          <DistributionBars rows={outcomeRows} label="Resultaat van de gesprekken" />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 space-y-3">
          <h2 className="label text-[var(--accent)]">Wat deze maand kost en opbrengt</h2>
          <dl className="text-sm space-y-2">
            <Row label="Kost per maand" value={euro(employee.monthlyCost)} />
            <Row label="Commissie-afspraak" value={commissionDescription} />
            <Row label="Commissie deze maand" value={euro(monthCommission)} />
            <Row label="Totale kost" value={euro(monthResult.totalCost)} />
            <Row
              label="Resultaat"
              value={euro(monthResult.profit)}
              tone={monthResult.profit >= 0 ? "var(--ok)" : "var(--alert)"}
              strong
            />
            <Row
              label="Verhouding"
              value={
                monthResult.ratio === null
                  ? "—"
                  : `${monthResult.ratio.toFixed(1)}× de kost`
              }
            />
          </dl>
          <p className="text-xs text-[var(--text-dim)]">
            {COMMISSION_TYPE_LABELS[employee.commissionType] ??
              employee.commissionType}
            . Omzet sinds de start: {euro(allTimeRevenue)} over {wonDeals.length}{" "}
            {wonDeals.length === 1 ? "verkoop" : "verkopen"}.
          </p>
        </section>

        <section className="panel p-4 lg:col-span-2 space-y-3">
          <h2 className="label text-[var(--accent)]">Verkopen</h2>
          {wonDeals.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">Nog niets verkocht.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Wat</th>
                  <th>Klant</th>
                  <th>Wanneer</th>
                  <th className="text-right">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {wonDeals.map((deal) => (
                  <tr key={deal.id}>
                    <td>{deal.title}</td>
                    <td>
                      {deal.lead ? (
                        <Link
                          href={`/leads/${deal.lead.id}`}
                          className="hover:text-[var(--accent)]"
                        >
                          {deal.customer?.name ?? deal.lead.name}
                        </Link>
                      ) : (
                        (deal.customer?.name ?? "—")
                      )}
                    </td>
                    <td className="text-sm">
                      {deal.wonAt?.toLocaleDateString("nl-BE")}
                    </td>
                    <td className="mono text-right">{euro(deal.wonValue ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="panel p-4 space-y-3">
        <h2 className="label text-[var(--accent)]">
          Zaken die deze medewerker opvolgt · {ownedLeads}
        </h2>
        {recentLeads.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Nog geen zaken op naam.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {recentLeads.map((lead) => (
              <li
                key={lead.id}
                className="border border-[var(--border)] p-2 flex justify-between gap-2 items-center"
              >
                <Link
                  href={`/leads/${lead.id}`}
                  className="text-sm truncate hover:text-[var(--accent)]"
                >
                  {lead.name}
                  {lead.city ? (
                    <span className="text-[var(--text-dim)]"> · {lead.city}</span>
                  ) : null}
                </Link>
                <span className="badge shrink-0">{statusLabel(lead.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className="mono text-2xl font-semibold mt-1" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? "border-t border-[var(--border)] pt-2 font-medium" : ""}`}
    >
      <dt className="text-[var(--text-dim)]">{label}</dt>
      <dd className="mono" style={{ color: tone }}>
        {value}
      </dd>
    </div>
  );
}
