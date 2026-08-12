import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import {
  contactLead,
  markLeadWon,
  releaseLead,
  setLeadCompliance,
  skipLead,
  takeLead,
  unskipLead,
} from "@/lib/actions";
import { TriageButtons } from "@/components/TriageButtons";
import { OwnerButton } from "@/components/OwnerButton";
import { ContractForm } from "@/components/ContractForm";
import { MailDraftPanel } from "@/components/MailDraftPanel";
import { ContactLogPanel } from "@/components/ContactLogPanel";
import { COMPLIANCE_LABELS, statusLabel } from "@/lib/constants";
import { euro } from "@/lib/team-stats";
import { activityCounts, buildActivity, contactCount } from "@/lib/activity";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Eén kleur per soort gebeurtenis, zodat de tijdlijn te scannen is. */
const TIMELINE_COLOURS: Record<string, string> = {
  call: "var(--accent)",
  email: "var(--ok)",
  visit: "var(--caution)",
  note: "var(--text-dim)",
  mail: "var(--ok)",
  document: "var(--caution)",
  lead: "var(--border)",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data },
    include: {
      outreach: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      owner: { select: { id: true, name: true } },
      deals: {
        where: { wonAt: { not: null } },
        orderBy: { wonAt: "desc" },
        select: {
          id: true,
          title: true,
          wonValue: true,
          wonAt: true,
          owner: { select: { name: true } },
        },
      },
    },
  });
  if (!lead) notFound();
  const [audits, products, documents, drafts] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { entityType: "lead", entityId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ line: "asc" }, { name: "asc" }],
      select: { id: true, name: true, line: true, listPrice: true },
    }),
    prisma.generatedDocument.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        createdAt: true,
        signerName: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.emailDraft.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        subject: true,
        body: true,
        status: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const timeline = buildActivity({
    outreach: lead.outreach,
    drafts,
    documents,
    audits,
  });
  const counts = activityCounts(timeline);
  const contacts = contactCount(timeline);
  const lastContact = timeline.find((i) =>
    ["call", "email", "visit", "note"].includes(i.kind)
  );

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="label">
            <Link href="/" className="hover:text-[var(--accent)]">
              Mijn leads
            </Link>
            {" · "}
            <Link href="/leads" className="hover:text-[var(--accent)]">
              Leads
            </Link>
          </p>
          <h1 className="text-3xl font-semibold mt-1">{lead.name}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            {[lead.address, lead.city, lead.province].filter(Boolean).join(" · ")}
          </p>
          {lead.owner && (
            <p className="text-sm mt-1">
              {lead.owner.id === user.id ? (
                <span className="text-[var(--accent)]">
                  Deze lead staat op <strong>jouw</strong> naam
                </span>
              ) : (
                <span className="text-[var(--text-dim)]">
                  <strong>{lead.owner.name}</strong> werkt aan deze lead
                </span>
              )}
            </p>
          )}
        </div>
        <div className="text-right space-y-2">
          <div className="score text-3xl">{lead.score}</div>
          <div>
            <span className="badge">{statusLabel(lead.status)}</span>
            {lead.hasVending && (
              <span className="badge badge-live ml-2">Heeft automaat</span>
            )}
          </div>
          <OwnerButton
            leadId={lead.id}
            ownerId={lead.ownerId}
            ownerName={lead.owner?.name ?? null}
            currentUserId={user.id}
            isAdmin={user.role === "admin"}
            takeAction={takeLead}
            releaseAction={releaseLead}
          />
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

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-3">Overzicht</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <OverviewStat label="Status" value={statusLabel(lead.status)} />
          <OverviewStat
            label="Eigenaar"
            value={
              lead.owner
                ? lead.owner.id === user.id
                  ? "Jij"
                  : lead.owner.name
                : "Niemand"
            }
          />
          <OverviewStat
            label="Contacten"
            value={String(contacts)}
          />
          <OverviewStat
            label="Laatste contact"
            value={
              lastContact
                ? lastContact.at.toLocaleDateString("nl-BE")
                : "—"
            }
          />
          <OverviewStat
            label="Volgende actie"
            value={
              lead.nextActionAt
                ? lead.nextActionAt.toLocaleString("nl-BE", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2 space-y-4">
          <h2 className="label text-[var(--accent)]">Bedrijf & aanpak</h2>
          <Info
            label="Onderneming / vestiging"
            value={[lead.intelligenceEnterpriseId, lead.intelligenceEstablishmentId]
              .filter(Boolean)
              .join(" / ")}
          />
          <Info label="Telefoon" value={lead.phone} />
          <Info label="E-mail" value={lead.email} />
          <Info label="Website" value={lead.website} />
          <Info label="Aanbevolen automaat" value={lead.recommendedMachine} />
          <Info label="Invalshoek" value={lead.recommendedAngle} />
          <Info label="Openingszin" value={lead.phoneOpener} />
          <Info label="Verwacht bezwaar" value={lead.likelyObjection} />
          <Info label="Onderbouwing" value={lead.evidenceSummary} />
          <Info label="Bestaande automaat" value={lead.vendingDetail} />
        </section>

        <div className="space-y-4">
          <ContactLogPanel leadId={lead.id} />

          <section className="panel p-4 space-y-3">
            <h2 className="label text-[var(--accent)]">Verkocht</h2>

            {lead.deals.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {lead.deals.map((deal) => (
                  <li
                    key={deal.id}
                    className="border-b border-[var(--border)] pb-2 last:border-0"
                  >
                    <div className="flex justify-between gap-2">
                      <span>{deal.title}</span>
                      <span className="mono" style={{ color: "var(--ok)" }}>
                        {euro(deal.wonValue ?? 0)}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {deal.owner?.name ?? "onbekend"} ·{" "}
                      {deal.wonAt?.toLocaleDateString("nl-BE")}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-dim)]">
                Nog niets verkocht aan deze zaak.
              </p>
            )}

            <form action={markLeadWon} className="space-y-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <input
                name="title"
                className="input"
                placeholder="Wat is er verkocht (optioneel)"
                maxLength={200}
              />
              <input
                name="value"
                type="number"
                min="0"
                step="1"
                className="input"
                placeholder="Bedrag in €"
                required
              />
              <button className="btn btn-primary w-full">Verkoop noteren</button>
              <p className="text-xs text-[var(--text-dim)]">
                Maakt een klant en een verkoop op jouw naam. Telt mee voor je
                commissie.
              </p>
            </form>
          </section>

          <section className="panel p-4 space-y-3">
            <h2 className="label text-[var(--accent)]">Mail</h2>
            <MailDraftPanel
              leadId={lead.id}
              hasWebsite={Boolean(lead.website)}
              drafts={drafts}
            />
          </section>

          <section className="panel p-4 space-y-3">
            <h2 className="label text-[var(--accent)]">Documenten</h2>

            {documents.length > 0 && (
              <ul className="space-y-2 text-sm">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="border-b border-[var(--border)] pb-2 last:border-0"
                  >
                    <Link
                      href={`/documenten/${doc.id}`}
                      className="hover:text-[var(--accent)]"
                    >
                      <span className="mono text-xs">{doc.number}</span>
                      <span className="block">{doc.title}</span>
                    </Link>
                    <div className="text-xs text-[var(--text-dim)]">
                      {doc.createdBy?.name ?? "onbekend"} ·{" "}
                      {doc.createdAt.toLocaleDateString("nl-BE")}
                      {doc.signerName ? ` · getekend door ${doc.signerName}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <ContractForm leadId={lead.id} products={products} />
          </section>

          <section className="panel p-4 space-y-3">
            <h2 className="label text-[var(--accent)]">Toestemming</h2>
            <p className="text-sm">
              <span className="badge">
                {COMPLIANCE_LABELS[lead.complianceStatus] ?? lead.complianceStatus}
              </span>
              {lead.doNotContact && <span className="badge ml-2">DNC</span>}
            </p>
            {lead.suppressionReason && (
              <p className="text-sm text-[var(--warn)]">{lead.suppressionReason}</p>
            )}
            <form action={setLeadCompliance} className="space-y-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <select
                name="complianceStatus"
                className="select"
                defaultValue={lead.complianceStatus}
              >
                <option value="PENDING">Nog te beslissen</option>
                <option value="CLEARED">Goedgekeurd</option>
                <option value="BLOCKED">Geblokkeerd</option>
              </select>
              <input
                name="suppressionReason"
                className="input"
                placeholder="Reden bij blokkeren"
              />
              <button className="btn btn-primary w-full">Opslaan</button>
            </form>
          </section>
        </div>
      </div>

      <section className="panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="label text-[var(--accent)]">Geschiedenis</h2>
          <p className="text-xs text-[var(--text-dim)]">
            {counts.call + counts.email + counts.visit + counts.note} contact
            {counts.call + counts.email + counts.visit + counts.note === 1
              ? ""
              : "en"}{" "}
            · {counts.mail} {counts.mail === 1 ? "mail" : "mails"} ·{" "}
            {counts.document}{" "}
            {counts.document === 1 ? "document" : "documenten"}
          </p>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Er is nog niets gebeurd met deze lead. Noteer je eerste contact
            hierboven.
          </p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((item) => (
              <li
                key={item.id}
                className="border-l-2 pl-3"
                style={{ borderColor: TIMELINE_COLOURS[item.kind] }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-sm">{item.title}</span>
                  {item.actor && (
                    <span className="text-xs text-[var(--text-dim)]">
                      door {item.actor}
                    </span>
                  )}
                </div>
                {item.detail && (
                  <div className="text-sm text-[var(--text-dim)] mt-0.5">
                    {item.detail}
                  </div>
                )}
                <div className="mono text-[0.65rem] text-[var(--text-mute)] mt-0.5">
                  {item.at.toLocaleString("nl-BE")}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="label">{label}</div>
      <p className="text-sm mt-1 text-[var(--text-dim)] whitespace-pre-wrap">
        {value || "—"}
      </p>
    </div>
  );
}
