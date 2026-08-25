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
  commissionForRentals,
  totalCommission,
  conversionRate,
  euro,
  percent,
  roi,
} from "@/lib/team-stats";
import { idSchema } from "@/lib/validation";
import {
  deleteMailExample,
  saveMailStyle,
} from "@/lib/mail-style-actions";

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

  const employee = await prisma.user.findUnique({
    where: { id: parsed.data },
    include: {
      mailExamples: {
        where: { approved: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!employee) notFound();

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - (DAYS - 1));
  windowStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [calls, wonDeals, ownedLeads, recentLeads, monthRentals] = await Promise.all([
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
    prisma.customer.count({
      where: {
        ownerId: employee.id,
        kind: "SHOP_TENANT",
        createdAt: { gte: monthStart },
      },
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
  const saleCommission = commissionForDeals(employee, monthValues);
  const rentalCommission = commissionForRentals(employee, monthRentals);
  const monthCommission = totalCommission(employee, monthValues, monthRentals);
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

  const saleCommissionDescription =
    employee.commissionType === "FIXED"
      ? `${euro(employee.commissionValue)} per verkoop`
      : `${employee.commissionValue}% van de verkoop`;
  const rentalCommissionDescription =
    employee.rentalCommissionFixed > 0
      ? `${euro(employee.rentalCommissionFixed)} per huurcontract`
      : "geen";

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

      <section className="panel p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="label text-[var(--accent)]">Persoonlijke mailstijl</h2>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Korte regels en goedgekeurde verzonden mails sturen toon, lengte,
            opening en afsluiting van nieuwe concepten.
          </p>
        </div>
        <form action={saveMailStyle} className="space-y-2">
          <input type="hidden" name="userId" value={employee.id} />
          <textarea
            name="mailStyleNotes"
            className="textarea"
            rows={5}
            maxLength={5000}
            defaultValue={employee.mailStyleNotes ?? ""}
            placeholder={"Bijvoorbeeld:\n- Kort en direct\n- Spreek aan met u\n- Open zonder smalltalk\n- Sluit af met Groeten"}
          />
          <button type="submit" className="btn btn-primary">
            Stijlregels bewaren
          </button>
        </form>
        <div>
          <h3 className="label mb-2">
            Goedgekeurde voorbeelden · {employee.mailExamples.length}
          </h3>
          {employee.mailExamples.length ? (
            <ul className="space-y-2">
              {employee.mailExamples.map((example) => (
                <li
                  key={example.id}
                  className="rounded-lg border border-[var(--border)] p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-medium">{example.subject}</span>
                      <p className="text-[var(--text-dim)] mt-1 line-clamp-3 whitespace-pre-wrap">
                        {example.body}
                      </p>
                    </div>
                    <form action={deleteMailExample}>
                      <input type="hidden" name="exampleId" value={example.id} />
                      <input type="hidden" name="userId" value={employee.id} />
                      <button type="submit" className="btn btn-sm btn-ghost">
                        Verwijder
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-dim)]">
              Bewaar een aangepaste verzonden mail op de leadfiche als voorbeeld.
            </p>
          )}
        </div>
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
            <Row label="Commissie verkoop" value={saleCommissionDescription} />
            <Row label="Commissie huur" value={rentalCommissionDescription} />
            <Row
              label="Commissie deze maand"
              value={`${euro(monthCommission)}${
                monthRentals > 0 || saleCommission > 0
                  ? ` (verkoop ${euro(saleCommission)} · huur ${euro(rentalCommission)})`
                  : ""
              }`}
            />
            <Row label="Huurcontracts deze maand" value={String(monthRentals)} />
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
