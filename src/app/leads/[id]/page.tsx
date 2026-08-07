import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { contactLead, setLeadCompliance, skipLead, unskipLead } from "@/lib/actions";
import { TriageButtons } from "@/components/TriageButtons";
import { COMPLIANCE_LABELS, statusLabel } from "@/lib/constants";
import { idSchema } from "@/lib/validation";

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
    include: { outreach: { orderBy: { createdAt: "desc" } } },
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
          <p className="label">{lead.tier || "Geen rang"} · {lead.source}</p>
          <h1 className="text-3xl font-semibold mt-1">{lead.name}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            {[lead.address, lead.city, lead.province].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right space-y-2">
          <div className="score text-3xl">{lead.score}</div>
          <div>
            <span className="badge">{statusLabel(lead.status)}</span>
            {lead.hasVending && <span className="badge badge-live ml-2">Heeft automaat</span>}
          </div>
          <TriageButtons
            leadId={lead.id}
            status={lead.status}
            complianceStatus={lead.complianceStatus}
            contactAction={contactLead}
            skipAction={skipLead}
            unskipAction={unskipLead}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2 space-y-4">
          <h2 className="label text-[var(--accent)]">Bedrijf & aanpak</h2>
          <Info label="Onderneming / vestiging" value={[lead.intelligenceEnterpriseId, lead.intelligenceEstablishmentId].filter(Boolean).join(" / ")} />
          <Info label="Aanbevolen automaat" value={lead.recommendedMachine} />
          <Info label="Invalshoek" value={lead.recommendedAngle} />
          <Info label="Openingszin" value={lead.phoneOpener} />
          <Info label="Verwacht bezwaar" value={lead.likelyObjection} />
          <Info label="Onderbouwing" value={lead.evidenceSummary} />
          <Info label="Bestaande automaat" value={lead.vendingDetail} />
          <Info label="Bronversie" value={lead.sourceVersion} />
        </section>

        <section className="panel p-4 space-y-3">
          <h2 className="label text-[var(--accent)]">Toestemming om te bellen</h2>
          <p className="text-sm">
            <span className="badge">{COMPLIANCE_LABELS[lead.complianceStatus] ?? lead.complianceStatus}</span>
            {lead.doNotContact && <span className="badge ml-2">DNC</span>}
          </p>
          {lead.suppressionReason && <p className="text-sm text-[var(--warn)]">{lead.suppressionReason}</p>}
          <form action={setLeadCompliance} className="space-y-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <select name="complianceStatus" className="select" defaultValue={lead.complianceStatus}>
              <option value="PENDING">Nog te beslissen</option>
              <option value="CLEARED">Goedgekeurd</option>
              <option value="BLOCKED">Geblokkeerd</option>
            </select>
            <input name="suppressionReason" className="input" placeholder="Reden bij blokkeren" />
            <button className="btn btn-primary w-full">Opslaan</button>
          </form>
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-3">Tijdlijn</h2>
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
