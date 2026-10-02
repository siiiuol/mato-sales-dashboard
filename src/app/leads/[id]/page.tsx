import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import {
  contactLead,
  releaseLead,
  setLeadCompliance,
  skipLead,
  takeLead,
  unskipLead,
} from "@/lib/actions";
import { createTask } from "@/lib/task-actions";
import { TriageButtons } from "@/components/TriageButtons";
import { OwnerButton } from "@/components/OwnerButton";
import { ContractForm } from "@/components/ContractForm";
import { MailDraftPanel } from "@/components/MailDraftPanel";
import { ReplySyncButton } from "@/components/ReplySyncButton";
import { ContactLogPanel } from "@/components/ContactLogPanel";
import { AiosAssistPanel } from "@/components/AiosAssistPanel";
import {
  COMPLIANCE_LABELS,
  categoryLabel,
  lossReasonLabel,
  statusLabel,
} from "@/lib/constants";
import { euro } from "@/lib/team-stats";
import { activityCounts, buildActivity, contactCount } from "@/lib/activity";
import { idSchema } from "@/lib/validation";
import { CadencePanel } from "@/components/CadencePanel";
import { StopLeadPanel } from "@/components/StopLeadPanel";
import { DealPanel } from "@/components/DealPanel";
import { NegotiationStrip } from "@/components/NegotiationStrip";
import { saveMailAsExample } from "@/lib/mail-style-actions";
import { ProductAdvisor } from "@/components/ProductAdvisor";
import { assignLeadCampaign } from "@/lib/campaign-actions";
import { LeadChatPanel } from "@/components/LeadChatPanel";
import { LeadProfileEnrichPanel } from "@/components/LeadProfileEnrichPanel";
import { CustomerMemoryPanel } from "@/components/CustomerMemoryPanel";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/** Eén kleur per soort gebeurtenis, zodat de tijdlijn te scannen is. */
const TIMELINE_COLOURS: Record<string, string> = {
  call: "var(--accent)",
  email: "var(--ok)",
  visit: "var(--caution)",
  note: "var(--text-dim)",
  mail: "var(--text-dim)",
  sent: "var(--ok)",
  reply: "var(--accent)",
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
      customer: { select: { id: true, kind: true } },
      deals: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          stage: true,
          expectedValue: true,
          probability: true,
          expectedCloseAt: true,
          nextStep: true,
          expectedMachineCount: true,
          wonValue: true,
          wonAt: true,
          grossMargin: true,
          owner: { select: { name: true } },
          lines: {
            select: {
              productId: true,
              qty: true,
              unitPrice: true,
              unitCost: true,
              product: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!lead) notFound();
  const [
    audits,
    products,
    documents,
    drafts,
    mail,
    mailbox,
    tasks,
    snippets,
    cadenceTasks,
    campaigns,
    comments,
    facts,
  ] = await Promise.all([
    prisma.auditEvent
      .findMany({
        where: { entityType: "lead", entityId: lead.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { name: true } } },
      })
      .catch(() => []),
    prisma.product
      .findMany({
        where: { active: true },
        orderBy: [{ line: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          line: true,
          listPrice: true,
          imageUrl: true,
        },
      })
      .catch(() => []),
    prisma.generatedDocument
      .findMany({
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
      })
      .catch(() => []),
    prisma.emailDraft
      .findMany({
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
      })
      .catch(() => []),
    prisma.mailMessage
      .findMany({
        where: { leadId: lead.id },
        orderBy: { occurredAt: "desc" },
        take: 50,
        select: {
          id: true,
          direction: true,
          subject: true,
          body: true,
          fromAddress: true,
          toAddress: true,
          occurredAt: true,
          user: { select: { id: true, name: true } },
        },
      })
      .catch(() => []),
    prisma.mailboxConnection
      .findUnique({
        where: { userId: user.id },
        select: { emailAddress: true },
      })
      .catch(() => null),
    prisma.task
      .findMany({
        where: { leadId: lead.id, status: { in: ["DONE", "CANCELLED"] } },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          completedAt: true,
          updatedAt: true,
          assignedTo: { select: { name: true } },
        },
      })
      .catch(() => []),
    prisma.mailSnippet
      .findMany({
        where: { active: true },
        orderBy: [{ situation: "asc" }, { label: "asc" }],
        select: { id: true, situation: true, label: true },
      })
      .catch(() => []),
    prisma.task
      .findMany({
        where: {
          leadId: lead.id,
          cadenceKey: "LEAD_FOLLOWUP",
          status: "OPEN",
        },
        orderBy: { cadenceStep: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          cadenceStep: true,
        },
      })
      .catch(() => []),
    prisma.campaign
      .findMany({
        where: { status: { in: ["PLANNED", "ACTIVE", "PAUSED"] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
      .catch(() => []),
    prisma.leadComment
      .findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
      })
      .catch(() => [] as Array<{
        id: string;
        body: string;
        createdAt: Date;
        author: { id: string; name: string };
      }>),
    prisma.customerFact
      .findMany({
        where: {
          leadId: lead.id,
          status: { in: ["SUGGESTED", "CONFIRMED"] },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          key: true,
          value: true,
          status: true,
          source: true,
          confidence: true,
        },
      })
      .catch(() => []),
  ]);

  const timeline = buildActivity({
    outreach: lead.outreach,
    drafts,
    documents,
    audits,
    mail,
    tasks,
  });
  const counts = activityCounts(timeline);
  const contacts = contactCount(timeline);
  const lastContact = timeline.find((i) =>
    ["call", "email", "visit", "note"].includes(i.kind)
  );
  const openDeal =
    lead.deals.find((deal) => !["WON", "LOST"].includes(deal.stage)) ?? null;
  const wonDeals = lead.deals.filter((deal) => deal.stage === "WON");
  const enrichedAtLabel = lead.profileEnrichedAt
    ? lead.profileEnrichedAt.toLocaleString("nl-BE")
    : null;
  const websiteHref = safeExternalHref(lead.website);
  const mapsHref = safeExternalHref(lead.mapsUrl);
  const recent = timeline.slice(0, 5);
  const place = [lead.city, lead.province].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-lg space-y-5 anim-lock sm:max-w-2xl">
      <div>
        <p className="label">
          <Link href="/" className="hover:text-[var(--accent)]">
            Vandaag
          </Link>
          {" · "}
          <Link href="/leads" className="hover:text-[var(--accent)]">
            Zaken
          </Link>
        </p>
        <h1 className="text-3xl font-semibold mt-1">{lead.name}</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {place || "Geen plaats"}
          {lead.owner
            ? lead.owner.id === user.id
              ? " · van jou"
              : ` · ${lead.owner.name}`
            : " · niemand"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="badge">{statusLabel(lead.status)}</span>
          {lead.hasVending ? (
            <span className="badge badge-live">Heeft automaat</span>
          ) : null}
          <OwnerButton
            leadId={lead.id}
            ownerId={lead.ownerId}
            ownerName={lead.owner?.name ?? null}
            currentUserId={user.id}
            isAdmin={user.role === "admin"}
            takeAction={takeLead}
            releaseAction={releaseLead}
            compact
          />
        </div>
      </div>

      {lead.phone ? (
        <a href={`tel:${lead.phone}`} className="btn btn-primary btn-call btn-press">
          Bellen
        </a>
      ) : (
        <Link href="/bellen" className="btn btn-primary btn-call btn-press">
          Bellen
        </Link>
      )}

      <ContactLogPanel leadId={lead.id} />

      <div className="grid grid-cols-2 gap-3">
        <a href="/klantdocumenten/werkblad.html?use=huur" className="doc-tray min-h-0 py-5">
          <span className="label text-[var(--accent)]">Document</span>
          <span className="mt-1 font-semibold">Verhuur</span>
        </a>
        <a href="/klantdocumenten/werkblad.html?use=koop" className="doc-tray min-h-0 py-5">
          <span className="label text-[var(--accent)]">Document</span>
          <span className="mt-1 font-semibold">Verkoop</span>
        </a>
      </div>

      <section>
        <h2 className="label text-[var(--accent)] mb-2">Laatste</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Nog niets genoteerd. Log hierboven je eerste contact.
          </p>
        ) : (
          <ol className="space-y-3">
            {recent.map((item) => (
              <li
                key={item.id}
                className="border-l-2 pl-3"
                style={{ borderColor: TIMELINE_COLOURS[item.kind] }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-sm">{item.title}</span>
                  {item.actor ? (
                    <span className="text-xs text-[var(--text-dim)]">
                      door {item.actor}
                    </span>
                  ) : null}
                </div>
                {item.detail ? (
                  <div className="text-sm text-[var(--text-dim)] mt-0.5">
                    {item.detail}
                  </div>
                ) : null}
                <div className="mono text-[0.65rem] text-[var(--text-mute)] mt-0.5">
                  {item.at.toLocaleString("nl-BE")}
                </div>
              </li>
            ))}
          </ol>
        )}
        {lastContact ? (
          <p className="text-xs text-[var(--text-dim)] mt-2">
            {contacts} contact{contacts === 1 ? "" : "en"} · {counts.sent} mail ·{" "}
            {counts.document} document
          </p>
        ) : null}
      </section>

      <div className="ios-list">
        <details>
          <summary>Mail</summary>
          <div className="ios-list-body space-y-3" id="mail">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[var(--text-dim)]">Concepten en verzonden mail</span>
              {mailbox ? <ReplySyncButton /> : null}
            </div>
            <MailDraftPanel
              leadId={lead.id}
              hasWebsite={Boolean(lead.website)}
              leadEmail={lead.email}
              mailboxAddress={mailbox?.emailAddress ?? null}
              drafts={drafts}
              snippets={snippets}
            />
            {mail.some(
              (message) =>
                message.direction === "OUT" &&
                (user.role === "admin" || message.user?.id === user.id)
            ) ? (
              <details>
                <summary className="text-xs text-[var(--text-dim)] cursor-pointer">
                  Verzonden mail als stijlvoorbeeld bewaren
                </summary>
                <ul className="space-y-2 mt-2">
                  {mail
                    .filter(
                      (message) =>
                        message.direction === "OUT" &&
                        (user.role === "admin" || message.user?.id === user.id)
                    )
                    .slice(0, 5)
                    .map((message) => (
                      <li
                        key={message.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">{message.subject}</span>
                        <form action={saveMailAsExample}>
                          <input
                            type="hidden"
                            name="mailMessageId"
                            value={message.id}
                          />
                          <input type="hidden" name="leadId" value={lead.id} />
                          <button type="submit" className="btn btn-sm">
                            Bewaar
                          </button>
                        </form>
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </div>
        </details>

        <details id="teamchat">
          <summary>Team</summary>
          <div className="ios-list-body">
            <LeadChatPanel
              leadId={lead.id}
              currentUserId={user.id}
              canPost={user.role === "admin" || user.role === "sales"}
              messages={comments.map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: c.createdAt.toISOString(),
                author: c.author,
              }))}
            />
          </div>
        </details>

        <details>
          <summary>Getekend / prijs</summary>
          <div className="ios-list-body space-y-4">
            {user.role !== "reviewer" ? (
              <DealPanel
                lead={{
                  id: lead.id,
                  name: lead.name,
                  address: lead.address,
                  city: lead.city,
                }}
                deal={openDeal}
                products={products}
              />
            ) : null}
            {wonDeals.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {wonDeals.map((deal) => (
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
            <div id="documenten">
              {documents.length > 0 ? (
                <ul className="space-y-2 text-sm mb-3">
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
              ) : null}
              <ContractForm
                leadId={lead.id}
                dealId={openDeal?.id}
                products={products}
                dealLine={
                  openDeal?.lines[0]
                    ? {
                        productId: openDeal.lines[0].productId,
                        qty: openDeal.lines[0].qty,
                        unitPrice: openDeal.lines[0].unitPrice,
                      }
                    : null
                }
                lead={{
                  name: lead.name,
                  address: lead.address,
                  city: lead.city,
                  province: lead.province,
                  phone: lead.phone,
                }}
              />
            </div>
          </div>
        </details>

        <details>
          <summary>Meer</summary>
          <div className="ios-list-body space-y-4">
            <CustomerMemoryPanel
              leadId={lead.id}
              facts={facts}
              canEdit={user.role === "admin" || user.role === "sales"}
            />
            <TriageButtons
              leadId={lead.id}
              status={lead.status}
              complianceStatus={lead.complianceStatus}
              contactAction={contactLead}
              skipAction={skipLead}
              unskipAction={unskipLead}
            />
            {user.role !== "reviewer" && !lead.customer ? (
              <Link href={`/shop/nieuw?leadId=${lead.id}`} className="btn btn-sm">
                Naar shop-huurder
              </Link>
            ) : null}
            <NegotiationStrip
              completed={{
                proposal: Boolean(lead.outreachPrep),
                deal: Boolean(openDeal),
                document: documents.length > 0,
                mail:
                  drafts.length > 0 ||
                  mail.some((message) => message.direction === "OUT"),
              }}
            />
            {user.role !== "reviewer" &&
            (user.role === "admin" || !lead.ownerId || lead.ownerId === user.id) ? (
              <LeadProfileEnrichPanel
                leadId={lead.id}
                enrichedAtLabel={enrichedAtLabel}
              />
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Info
                label="Sector"
                value={lead.category ? categoryLabel(lead.category) : null}
              />
              <Info
                label="Bron"
                value={[
                  sourceLabel(lead.source),
                  enrichedAtLabel ? `verrijkt ${enrichedAtLabel}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Info
                className="sm:col-span-2"
                label="Onderneming / vestiging"
                value={[
                  lead.enterpriseName,
                  lead.establishmentName,
                  lead.intelligenceEnterpriseId,
                  lead.intelligenceEstablishmentId,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Info
                label="Telefoon"
                value={
                  lead.phone ? (
                    <a
                      className="text-[var(--accent)] hover:underline"
                      href={`tel:${lead.phone}`}
                    >
                      {lead.phone}
                    </a>
                  ) : null
                }
              />
              <Info
                label="E-mail"
                value={
                  lead.email ? (
                    <a
                      className="text-[var(--accent)] hover:underline"
                      href={`mailto:${lead.email}`}
                    >
                      {lead.email}
                    </a>
                  ) : null
                }
              />
              <Info
                label="Website"
                value={
                  lead.website ? (
                    websiteHref ? (
                      <a
                        className="text-[var(--accent)] hover:underline break-all"
                        href={websiteHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {lead.website}
                      </a>
                    ) : (
                      lead.website
                    )
                  ) : null
                }
              />
              <Info
                label="Kaart"
                value={
                  mapsHref ? (
                    <a
                      className="text-[var(--accent)] hover:underline"
                      href={mapsHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open locatie
                    </a>
                  ) : null
                }
              />
              <Info
                label="Beoordelingen"
                value={
                  lead.rating != null
                    ? `${lead.rating.toLocaleString("nl-BE", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}/5 · ${lead.reviewCount} beoordelingen`
                    : lead.reviewCount > 0
                      ? `${lead.reviewCount} beoordelingen`
                      : null
                }
              />
              <Info
                label="Bedrijfsstatus"
                value={businessStatusLabel(lead.businessStatus)}
              />
              <Info
                className="sm:col-span-2"
                label="Openingsuren"
                value={lead.openingHours}
              />
              <Info
                className="sm:col-span-2"
                label="Bedrijfssamenvatting"
                value={lead.evidenceSummary}
              />
              <Info label="Aanbevolen automaat" value={lead.recommendedMachine} />
              <Info label="Bestaande automaat" value={lead.vendingDetail} />
              <Info
                className="sm:col-span-2"
                label="Invalshoek"
                value={lead.recommendedAngle}
              />
            </div>
            {lead.lossReason ? (
              <Info
                label="Stop-/verliesreden"
                value={lossReasonLabel(lead.lossReason)}
              />
            ) : null}
            {user.role !== "reviewer" && campaigns.length ? (
              <form action={assignLeadCampaign}>
                <input type="hidden" name="leadId" value={lead.id} />
                <label className="label block mb-1">Campagnebron</label>
                <div className="flex gap-2">
                  <select
                    name="campaignId"
                    className="select"
                    defaultValue={lead.campaignId ?? ""}
                  >
                    <option value="">Geen campagne</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-sm">
                    Bewaar
                  </button>
                </div>
              </form>
            ) : null}
            <CadencePanel cadenceKey="LEAD_FOLLOWUP" tasks={cadenceTasks} />
            <StopLeadPanel leadId={lead.id} />
            {user.role !== "reviewer" ? (
              <div id="voorstel">
                <AiosAssistPanel leadId={lead.id} />
              </div>
            ) : null}
            {user.role !== "reviewer" ? (
              <ProductAdvisor category={lead.category} />
            ) : null}
            <section className="space-y-2">
              <h3 className="label">Taak toevoegen</h3>
              <form action={createTask} className="space-y-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <input
                  name="title"
                  className="input"
                  placeholder="Wat moet er gebeuren"
                  required
                  maxLength={200}
                />
                <input name="dueAt" type="datetime-local" className="input" />
                <button type="submit" className="btn w-full">
                  Toevoegen
                </button>
              </form>
            </section>
            <details>
              <summary className="label cursor-pointer">
                Toestemming ·{" "}
                {COMPLIANCE_LABELS[lead.complianceStatus] ?? lead.complianceStatus}
                {lead.doNotContact ? " · DNC" : ""}
              </summary>
              <div className="space-y-2 mt-3">
                {lead.suppressionReason ? (
                  <p className="text-sm text-[var(--warn)]">{lead.suppressionReason}</p>
                ) : null}
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
              </div>
            </details>
          </div>
        </details>
      </div>
    </div>
  );
}

function Info({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value?: ReactNode;
}) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className={className}>
      <div className="label">{label}</div>
      <p className="text-sm mt-1 text-[var(--text-dim)] whitespace-pre-wrap">
        {display}
      </p>
    </div>
  );
}

function sourceLabel(source: string): string {
  if (source === "places") return "Google Places";
  if (source === "openstreetmap") return "OpenStreetMap";
  return source;
}

function businessStatusLabel(status?: string | null): string | null {
  if (!status) return null;
  if (status === "OPERATIONAL") return "Actief volgens Google";
  if (status === "CLOSED_TEMPORARILY") return "Tijdelijk gesloten volgens Google";
  if (status === "CLOSED_PERMANENTLY") return "Permanent gesloten volgens Google";
  return status;
}

function safeExternalHref(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
