import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createFollowUp, createMeeting, setLeadCompliance } from "@/lib/actions";
import { idSchema } from "@/lib/validation";
import { formatEUR } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data },
    include: {
      outreach: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueAt: "asc" } },
      deals: { include: { lines: true }, orderBy: { updatedAt: "desc" } },
      meetings: { orderBy: { startsAt: "desc" } },
      quotes: { orderBy: { createdAt: "desc" } },
      emailDrafts: { orderBy: { createdAt: "desc" } },
      customer: { include: { purchases: { include: { product: true } } } },
    },
  });
  if (!lead) notFound();
  const audits = await prisma.auditEvent.findMany({
    where: { entityType: "lead", entityId: lead.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const timeline = [
    ...lead.outreach.map((item) => ({
      id: item.id,
      at: item.createdAt,
      title: `${item.type} · ${item.outcome || "logged"}`,
      detail: item.note,
    })),
    ...lead.tasks.map((item) => ({
      id: item.id,
      at: item.createdAt,
      title: `Task · ${item.title}`,
      detail: `${item.status}${item.dueAt ? ` · due ${item.dueAt.toLocaleString("nl-BE")}` : ""}`,
    })),
    ...audits.map((item) => ({
      id: item.id,
      at: item.createdAt,
      title: item.action,
      detail: item.detail,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="label">{lead.tier || "UNRANKED"} · {lead.source}</p>
          <h1 className="text-3xl font-semibold mt-1">{lead.name}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            {[lead.address, lead.city, lead.province].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <div className="score text-3xl">{lead.score}</div>
          <span className="badge">{lead.status}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2 space-y-4">
          <h2 className="label text-[var(--accent)]">Intelligence & outreach</h2>
          <Info label="Enterprise / establishment" value={[lead.intelligenceEnterpriseId, lead.intelligenceEstablishmentId].filter(Boolean).join(" / ")} />
          <Info label="Recommended machine" value={lead.recommendedMachine} />
          <Info label="Contact angle" value={lead.recommendedAngle} />
          <Info label="Phone opener" value={lead.phoneOpener} />
          <Info label="Likely objection" value={lead.likelyObjection} />
          <Info label="Evidence" value={lead.evidenceSummary} />
          <Info label="Source version" value={lead.sourceVersion} />
        </section>

        <section className="panel p-4 space-y-3">
          <h2 className="label text-[var(--accent)]">Compliance gate</h2>
          <p className="text-sm">
            <span className="badge">{lead.complianceStatus}</span>
            {lead.doNotContact && <span className="badge ml-2">DNC</span>}
          </p>
          {lead.suppressionReason && <p className="text-sm text-[var(--warn)]">{lead.suppressionReason}</p>}
          <form action={setLeadCompliance} className="space-y-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <select name="complianceStatus" className="select" defaultValue={lead.complianceStatus}>
              <option value="PENDING">Pending review</option>
              <option value="CLEARED">Cleared</option>
              <option value="BLOCKED">Blocked / DNC</option>
            </select>
            <input name="suppressionReason" className="input" placeholder="Reason when blocked" />
            <button className="btn btn-primary w-full">Apply gate</button>
          </form>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="label text-[var(--accent)] mb-3">Follow-up</h2>
          <form action={createFollowUp} className="grid gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <input name="title" className="input" placeholder="Follow-up action" required />
            <input name="dueAt" type="datetime-local" className="input" required />
            <textarea name="description" className="textarea" placeholder="Context" />
            <button className="btn btn-primary">Create follow-up</button>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {lead.tasks.map((task) => (
              <li key={task.id}>{task.status} · {task.title} · {task.dueAt?.toLocaleString("nl-BE") || "unscheduled"}</li>
            ))}
          </ul>
        </section>

        <section className="panel p-4">
          <h2 className="label text-[var(--accent)] mb-3">Deals & installed base</h2>
          <ul className="space-y-2 text-sm">
            {lead.deals.map((deal) => (
              <li key={deal.id} className="flex justify-between">
                <span>{deal.title} · {deal.stage}</span>
                <span>{deal.probability}% · {deal.expectedMachineCount} machines</span>
              </li>
            ))}
            {lead.customer?.purchases.map((purchase) => (
              <li key={purchase.id} className="flex justify-between text-[var(--text-dim)]">
                <span>Installed: {purchase.qty}× {purchase.product.name}</span>
                <span>{formatEUR(purchase.qty * purchase.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <form action={createMeeting} className="grid gap-2 mt-4 border-t border-[var(--border)] pt-4">
            <input type="hidden" name="leadId" value={lead.id} />
            <input name="title" className="input" placeholder="Meeting title" required />
            <input name="startsAt" type="datetime-local" className="input" required />
            <input name="location" className="input" placeholder="Location / video link" />
            <button className="btn btn-primary">Schedule meeting</button>
          </form>
          {!!lead.meetings.length && (
            <ul className="mt-3 text-sm text-[var(--text-dim)]">
              {lead.meetings.map((meeting) => (
                <li key={meeting.id}>{meeting.startsAt.toLocaleString("nl-BE")} · {meeting.title}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-3">Timeline</h2>
        <ol className="space-y-3">
          {timeline.map((item) => (
            <li key={item.id} className="border-l border-[var(--accent-dim)] pl-3">
              <div className="font-medium text-sm">{item.title}</div>
              <div className="text-xs text-[var(--text-dim)]">{item.at.toLocaleString("nl-BE")} · {item.detail || "—"}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="label">{label}</div>
      <p className="text-sm mt-1 text-[var(--text-dim)] whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}
