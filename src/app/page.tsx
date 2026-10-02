import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { categoryLabel, statusLabel } from "@/lib/constants";
import { OPEN_LEAD_STATUSES, utcDayBounds } from "@/lib/today-dashboard";
import {
  dealExpectedEuro,
  rankLeads,
  type NbaInput,
} from "@/lib/next-best-action";

export const dynamic = "force-dynamic";

const OPEN_STATUSES: readonly string[] = OPEN_LEAD_STATUSES;

/**
 * Vandaag = alleen míjn wachtrij + één knop Bellen.
 * Geen KPI-grid, geen datakwaliteit, geen teamcijfers.
 */
export default async function HomePage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const now = new Date();
  const { start: startOfToday, end: startOfTomorrow } = utcDayBounds(now);

  const myLeads = await prisma.lead.findMany({
    where: {
      ownerId: user.id,
      status: { in: [...OPEN_STATUSES] },
    },
    select: {
      id: true,
      name: true,
      city: true,
      category: true,
      phone: true,
      status: true,
      score: true,
      nextActionAt: true,
      lastTouchedAt: true,
      deals: {
        where: { stage: { notIn: ["WON", "LOST"] } },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          stage: true,
          expectedValue: true,
          probability: true,
          wonValue: true,
        },
      },
      mail: {
        where: { direction: "IN" },
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true },
      },
    },
  });

  const lastOutbound = await prisma.mailMessage.findMany({
    where: {
      leadId: { in: myLeads.map((l) => l.id) },
      direction: "OUT",
    },
    orderBy: { occurredAt: "desc" },
    distinct: ["leadId"],
    select: { leadId: true, occurredAt: true },
  });
  const lastOutByLead = new Map(
    lastOutbound
      .filter((row): row is typeof row & { leadId: string } => Boolean(row.leadId))
      .map((row) => [row.leadId, row.occurredAt])
  );

  const overdue = myLeads.filter(
    (lead) => lead.nextActionAt && lead.nextActionAt < startOfToday
  );
  const dueToday = myLeads.filter(
    (lead) =>
      lead.nextActionAt &&
      lead.nextActionAt >= startOfToday &&
      lead.nextActionAt < startOfTomorrow
  );

  const inputs: NbaInput[] = myLeads.map((lead) => {
    const deal = lead.deals[0] ?? null;
    const lastIn = lead.mail[0]?.occurredAt ?? null;
    const lastOut = lastOutByLead.get(lead.id) ?? null;
    const hasUnansweredInbound = Boolean(
      lastIn && (!lastOut || lastIn > lastOut)
    );
    return {
      id: lead.id,
      leadScore: lead.score,
      nextActionAt: lead.nextActionAt,
      lastTouchedAt: lead.lastTouchedAt,
      expectedValue: deal ? dealExpectedEuro(deal) : 0,
      dealStage: deal?.stage ?? null,
      hasUnansweredInbound,
    };
  });

  const ranked = rankLeads(inputs, now);
  const byId = new Map(myLeads.map((lead) => [lead.id, lead]));

  return (
    <div className="mx-auto max-w-lg space-y-5 anim-lock">
      <div>
        <p className="label">Vandaag</p>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Vandaag
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {overdue.length} te laat · {dueToday.length} vandaag
        </p>
      </div>

      <Link href="/bellen" className="btn btn-primary btn-call btn-press">
        Bellen
      </Link>

      {ranked.length === 0 ? (
        <section className="panel p-8 text-center space-y-3">
          <p className="text-[var(--text-dim)]">
            Je hebt nog geen open zaak op je naam.
          </p>
          <p className="text-sm text-[var(--text-dim)]">
            Zoek een bedrijf in Zaken en neem het op je naam.
          </p>
          <Link href="/leads" className="btn btn-primary">
            Naar Zaken
          </Link>
        </section>
      ) : (
        <ul className="ios-list">
          {ranked.map((item) => {
            const lead = byId.get(item.id);
            if (!lead) return null;
            const isOverdue =
              lead.nextActionAt && lead.nextActionAt < startOfToday;
            return (
              <li
                key={lead.id}
                className="border-b border-[var(--line)] last:border-0"
              >
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">
                      {lead.name}
                    </span>
                    <span className="block text-sm text-[var(--text-dim)] truncate">
                      {item.reason}
                      {" · "}
                      {[categoryLabel(lead.category), statusLabel(lead.status)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      isOverdue
                        ? "text-[var(--danger)]"
                        : "text-[var(--text-dim)]"
                    }`}
                  >
                    {isOverdue
                      ? "Te laat"
                      : lead.nextActionAt &&
                          lead.nextActionAt >= startOfToday &&
                          lead.nextActionAt < startOfTomorrow
                        ? "Vandaag"
                        : lead.nextActionAt
                          ? lead.nextActionAt.toLocaleDateString("nl-BE", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
