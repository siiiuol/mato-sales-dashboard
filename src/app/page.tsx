import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { releaseLead, takeLead } from "@/lib/actions";
import { OwnerButton } from "@/components/OwnerButton";
import {
  LEAD_STATUSES,
  categoryLabel,
  contactTypeLabel,
  outcomeLabel,
  statusLabel,
} from "@/lib/constants";
import { euro } from "@/lib/team-stats";
import { TaskStrip } from "@/components/TaskStrip";

export const dynamic = "force-dynamic";

/**
 * Statussen waaraan nog gewerkt wordt. Gewonnen en afgehaakte zaken zakken naar
 * beneden — ze horen wel in je overzicht te blijven staan, maar niet bovenaan
 * je werklijst.
 */
const OPEN_STATUSES = ["NEW", "TO_CALL", "CONTACTED", "FOLLOW_UP", "NEGOTIATION"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const sp = await searchParams;

  const leads = await prisma.lead.findMany({
    where: {
      ownerId: user.id,
      ...(sp.status ? { status: sp.status as never } : {}),
    },
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
  });

  const open = leads.filter((l) => OPEN_STATUSES.includes(l.status));
  const closed = leads.filter((l) => !OPEN_STATUSES.includes(l.status));
  const revenue = leads.reduce(
    (sum, l) => sum + l.deals.reduce((s, d) => s + (d.wonValue ?? 0), 0),
    0
  );

  const now = new Date();
  const due = open.filter((l) => l.nextActionAt && l.nextActionAt <= now);

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="label">Mijn leads</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            Waar jij aan werkt
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {leads.length} op jouw naam · {open.length} open
            {due.length > 0 ? ` · ${due.length} vandaag opvolgen` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads" className="btn btn-primary">
            Meer leads zoeken
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Figure label="Open" value={String(open.length)} />
        <Figure label="Vandaag opvolgen" value={String(due.length)} />
        <Figure label="Verkocht" value={euro(revenue)} />
      </section>

      <TaskStrip userId={user.id} />

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
            <th>Volgende actie</th>
            <th>Laatste contact</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const last = lead.outreach[0];
            const overdue = lead.nextActionAt && lead.nextActionAt <= now;
            const lastLabel = last
              ? [
                  contactTypeLabel(last.type),
                  last.outcome ? outcomeLabel(last.outcome) : null,
                ]
                  .filter(Boolean)
                  .join(" — ")
              : "nog geen contact";
            return (
              <tr key={lead.id}>
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
                  </div>
                  {overdue && (
                    <span className="badge badge-live mt-1">Vandaag opvolgen</span>
                  )}
                </td>
                <td className="text-sm text-[var(--text-dim)]">
                  {lead.city ?? "—"}
                </td>
                <td className="text-xs text-[var(--text-dim)]">
                  {lead.nextActionAt
                    ? lead.nextActionAt.toLocaleString("nl-BE", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="text-xs text-[var(--text-dim)]">
                  {last ? (
                    <>
                      <div>{lastLabel}</div>
                      <div className="text-[var(--text-mute)]">
                        {last.createdAt.toLocaleDateString("nl-BE")}
                      </div>
                    </>
                  ) : (
                    lastLabel
                  )}
                </td>
                <td>
                  <span className="badge">{statusLabel(lead.status)}</span>
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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className="mono text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
