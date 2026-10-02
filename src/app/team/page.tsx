import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { Avatar } from "@/components/Avatar";
import { roleLabel } from "@/lib/constants";
import { OPEN_LEAD_STATUSES, utcDayBounds } from "@/lib/today-dashboard";

export const dynamic = "force-dynamic";

/**
 * Team voor leiding: wie belt, wie stilstaat.
 * Geen KPI-feest — dat staat in Rapporten.
 */
export default async function TeamPage() {
  await requirePageUser(["admin"]);

  const now = new Date();
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { start: startOfToday } = utcDayBounds(now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [employees, outreach, openLeads] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        photoUrl: true,
        lastLoginAt: true,
      },
    }),
    prisma.outreachEvent.findMany({
      where: { createdAt: { gte: monthStart }, type: "CALL" },
      select: { createdById: true, createdAt: true },
    }),
    prisma.lead.findMany({
      where: {
        ownerId: { not: null },
        status: { in: [...OPEN_LEAD_STATUSES] },
      },
      select: {
        ownerId: true,
        nextActionAt: true,
        lastTouchedAt: true,
      },
    }),
  ]);

  const callsBy = new Map<string, number>();
  const lastCallBy = new Map<string, Date>();
  for (const event of outreach) {
    if (!event.createdById) continue;
    callsBy.set(event.createdById, (callsBy.get(event.createdById) ?? 0) + 1);
    const prev = lastCallBy.get(event.createdById);
    if (!prev || event.createdAt > prev) {
      lastCallBy.set(event.createdById, event.createdAt);
    }
  }

  const overdueBy = new Map<string, number>();
  const openBy = new Map<string, number>();
  for (const lead of openLeads) {
    if (!lead.ownerId) continue;
    openBy.set(lead.ownerId, (openBy.get(lead.ownerId) ?? 0) + 1);
    if (lead.nextActionAt && lead.nextActionAt < startOfToday) {
      overdueBy.set(lead.ownerId, (overdueBy.get(lead.ownerId) ?? 0) + 1);
    }
  }

  const rows = employees
    .filter((employee) => employee.role === "sales" || employee.role === "admin")
    .map((employee) => {
      const calls = callsBy.get(employee.id) ?? 0;
      const lastCall = lastCallBy.get(employee.id) ?? null;
      const overdue = overdueBy.get(employee.id) ?? 0;
      const open = openBy.get(employee.id) ?? 0;
      const silent =
        calls === 0 ||
        (lastCall != null && lastCall < sevenDaysAgo) ||
        (lastCall == null && open > 0);
      return { employee, calls, lastCall, overdue, open, silent };
    })
    .sort((a, b) => {
      if (a.silent !== b.silent) return a.silent ? -1 : 1;
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      return b.calls - a.calls;
    });

  const silentCount = rows.filter((row) => row.silent).length;
  const monthName = monthStart.toLocaleDateString("nl-BE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 anim-lock">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Team</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            Wie belt
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {monthName} · {silentCount} stil · {rows.length} mensen
          </p>
        </div>
        <Link href="/team/new" className="btn btn-sm shrink-0">
          Toevoegen
        </Link>
      </div>

      <ul className="ios-list">
        {rows.map((row) => (
          <li
            key={row.employee.id}
            className="border-b border-[var(--line)] last:border-0"
          >
            <Link
              href={`/team/${row.employee.id}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar
                name={row.employee.name}
                photoUrl={row.employee.photoUrl}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold truncate">
                  {row.employee.name}
                </span>
                <span className="block text-sm text-[var(--text-dim)] truncate">
                  {row.calls} gesprekken
                  {row.open ? ` · ${row.open} open` : ""}
                  {row.overdue ? ` · ${row.overdue} te laat` : ""}
                  {" · "}
                  {roleLabel(row.employee.role)}
                </span>
              </span>
              <span
                className={`shrink-0 text-xs font-semibold ${
                  row.silent
                    ? "text-[var(--danger)]"
                    : "text-[var(--text-dim)]"
                }`}
              >
                {row.silent
                  ? "Stil"
                  : row.lastCall
                    ? row.lastCall.toLocaleDateString("nl-BE", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--text-dim)] text-center">
        Omzet en commissie staan in Rapporten. Hier alleen: wie belt en wie
        stilstaat.
      </p>
    </div>
  );
}
