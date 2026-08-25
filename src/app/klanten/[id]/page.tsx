import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { euro } from "@/lib/team-stats";
import { buildActivity, activityCounts } from "@/lib/activity";
import { idSchema } from "@/lib/validation";
import {
  contactName,
  contactRoleLabel,
  CONTACT_INFLUENCE_LABELS,
  machineStatusLabel,
} from "@/lib/constants";
import { markMachineRemoved } from "@/lib/machine-actions";
import { createTask } from "@/lib/task-actions";
import { generateCustomerDocument } from "@/lib/customer-document-actions";
import { templateKeys } from "@/lib/documents";
import { ContactPersonForm } from "@/components/ContactPersonForm";
import { MachinePlacementForm } from "@/components/MachinePlacementForm";
import { CustomerDocumentForm } from "@/components/CustomerDocumentForm";

/** Sjablonen met een eigen, gerichte knop op deze pagina — niet nog eens generiek aanbieden. */
const DEDICATED_TEMPLATE_CODES = ["VERKOOP", "OPSTART"];

export const dynamic = "force-dynamic";

/** Eén kleur per soort gebeurtenis — zelfde palet als de leadfiche. */
const TIMELINE_COLOURS: Record<string, string> = {
  call: "var(--accent)",
  email: "var(--ok)",
  visit: "var(--caution)",
  note: "var(--text-dim)",
  mail: "var(--text-dim)",
  sent: "var(--ok)",
  reply: "var(--accent)",
  document: "var(--caution)",
  task: "var(--accent)",
  lead: "var(--border)",
};

export default async function KlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data },
    include: {
      deals: {
        where: { wonAt: { not: null } },
        orderBy: { wonAt: "desc" },
        select: { id: true, title: true, wonValue: true, wonAt: true, owner: { select: { name: true } } },
      },
      purchases: {
        orderBy: { purchasedAt: "desc" },
        include: { product: { select: { name: true } } },
      },
      contacts: { orderBy: { createdAt: "desc" } },
      machinePlacements: {
        orderBy: { placedAt: "desc" },
        include: { product: { select: { name: true } } },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, title: true, status: true, createdAt: true, signerName: true },
      },
      tasks: {
        where: { status: { in: ["DONE", "CANCELLED"] } },
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
      },
    },
  });
  if (!customer) notFound();
  if (customer.kind === "SHOP_TENANT") redirect(`/shop/${customer.id}`);

  const entityIds = [
    ...customer.contacts.map((c) => c.id),
    ...customer.machinePlacements.map((m) => m.id),
    ...customer.deals.map((deal) => deal.id),
  ];

  const [
    products,
    audits,
    otherTemplates,
    leadHistory,
    leadAudits,
    openTasks,
  ] =
    await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ line: "asc" }, { name: "asc" }],
      select: { id: true, name: true, line: true },
    }),
    entityIds.length
      ? prisma.auditEvent.findMany({
          where: { entityId: { in: entityIds } },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { actor: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.documentTemplate.findMany({
      where: { status: "MATO_APPROVED", code: { notIn: DEDICATED_TEMPLATE_CODES } },
      orderBy: { name: "asc" },
      select: { code: true, name: true, body: true },
    }),
    customer.leadId
      ? prisma.lead.findUnique({
          where: { id: customer.leadId },
          select: {
            outreach: {
              orderBy: { createdAt: "desc" },
              include: { createdBy: { select: { name: true } } },
            },
            emailDrafts: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                subject: true,
                body: true,
                status: true,
                createdAt: true,
                createdBy: { select: { name: true } },
              },
            },
            mail: {
              orderBy: { occurredAt: "desc" },
              select: {
                id: true,
                direction: true,
                subject: true,
                body: true,
                fromAddress: true,
                toAddress: true,
                occurredAt: true,
                user: { select: { name: true } },
              },
            },
            documents: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                number: true,
                title: true,
                status: true,
                createdAt: true,
                signerName: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    customer.leadId
      ? prisma.auditEvent.findMany({
          where: { entityType: "lead", entityId: customer.leadId },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { actor: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { customerId: customer.id, status: "OPEN" },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      select: {
        id: true,
        title: true,
        dueAt: true,
        cadenceKey: true,
        cadenceStep: true,
      },
    }),
  ]);

  const genericTemplates = otherTemplates.map((t) => ({
    code: t.code,
    name: t.name,
    fields: templateKeys(t.body).filter((k) => k !== "datum" && k !== "documentnummer"),
  }));
  const customerDefaults: Record<string, string> = {
    klant_naam: customer.name,
    klant_adres: customer.address ?? "",
    klant_gemeente: [customer.city, customer.province].filter(Boolean).join(", "),
    klant_telefoon: customer.phone ?? "",
    klant_email: customer.email ?? "",
  };

  const allDocuments = [
    ...customer.documents,
    ...(leadHistory?.documents ?? []),
  ].filter(
    (document, index, documents) =>
      documents.findIndex((candidate) => candidate.id === document.id) === index
  );
  const timeline = buildActivity({
    outreach: leadHistory?.outreach ?? [],
    drafts: leadHistory?.emailDrafts ?? [],
    documents: allDocuments,
    audits: [...audits, ...leadAudits],
    mail: leadHistory?.mail ?? [],
    tasks: customer.tasks,
  });
  const counts = activityCounts(timeline);
  const revenue = customer.deals.reduce((sum, d) => sum + (d.wonValue ?? 0), 0);
  const activeMachines = customer.machinePlacements.filter((m) => m.status === "ACTIVE");

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="label">
            <Link href="/klanten" className="hover:text-[var(--accent)]">
              Klanten
            </Link>
          </p>
          <h1 className="text-3xl font-semibold mt-1">{customer.name}</h1>
          <p className="text-sm text-[var(--text-dim)]">
            {[customer.address, customer.city, customer.province].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="text-right">
          <div className="label">Omzet</div>
          <div className="text-2xl font-semibold mt-1">{euro(revenue)}</div>
        </div>
      </div>

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-3">Overzicht</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <OverviewStat label="Contactpersonen" value={String(customer.contacts.length)} />
          <OverviewStat label="Automaten actief" value={String(activeMachines.length)} />
          <OverviewStat
            label="Klant sinds"
            value={
              customer.deals.length
                ? [...customer.deals].sort((a, b) => (a.wonAt?.getTime() ?? 0) - (b.wonAt?.getTime() ?? 0))[0]
                    .wonAt!.toLocaleDateString("nl-BE")
                : customer.createdAt.toLocaleDateString("nl-BE")
            }
          />
          <OverviewStat
            label="Volgende actie"
            value={
              customer.nextActionAt
                ? customer.nextActionAt.toLocaleString("nl-BE", {
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
          <h2 className="label text-[var(--accent)]">Klantgegevens</h2>
          <Info label="Telefoon" value={customer.phone} />
          <Info label="E-mail" value={customer.email} />
          <Info label="Website" value={customer.website} />
          <Info label="Notities" value={customer.notes} />

          <div className="border-t border-[var(--border)] pt-4">
            <h3 className="label text-[var(--accent)] mb-2">Verkocht</h3>
            {customer.deals.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {customer.deals.map((deal) => (
                  <li key={deal.id} className="border-b border-[var(--border)] pb-2 last:border-0">
                    <div className="flex justify-between gap-2">
                      <span>{deal.title}</span>
                      <span className="mono" style={{ color: "var(--ok)" }}>
                        {euro(deal.wonValue ?? 0)}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {deal.owner?.name ?? "onbekend"} · {deal.wonAt?.toLocaleDateString("nl-BE")}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-dim)]">Nog niets verkocht.</p>
            )}
          </div>

          {customer.purchases.length > 0 && (
            <div className="border-t border-[var(--border)] pt-4">
              <h3 className="label text-[var(--accent)] mb-2">Aankopen</h3>
              <ul className="space-y-1 text-sm">
                {customer.purchases.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>
                      {p.qty}× {p.product.name}
                    </span>
                    <span className="mono">{euro(p.qty * p.unitPrice)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-4">
            <h3 className="label text-[var(--accent)] mb-2">Documenten</h3>
            {customer.documents.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {customer.documents.map((doc) => (
                  <li key={doc.id} className="border-b border-[var(--border)] pb-2 last:border-0">
                    <Link href={`/documenten/${doc.id}`} className="hover:text-[var(--accent)]">
                      <span className="mono text-xs">{doc.number}</span>
                      <span className="block">{doc.title}</span>
                    </Link>
                    <div className="text-xs text-[var(--text-dim)]">
                      {doc.createdAt.toLocaleDateString("nl-BE")}
                      {doc.signerName ? ` · getekend door ${doc.signerName}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-dim)]">Nog geen documenten voor deze klant.</p>
            )}

            {activeMachines.length > 0 && (
              <form action={generateCustomerDocument} className="flex flex-wrap gap-2 items-center pt-2">
                <input type="hidden" name="customerId" value={customer.id} />
                <select name="machinePlacementId" className="select" required>
                  {activeMachines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model || m.product?.name || "Onbekend model"}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn">
                  Opstartbevestiging maken
                </button>
              </form>
            )}

            <CustomerDocumentForm
              customerId={customer.id}
              templates={genericTemplates}
              defaults={customerDefaults}
            />
          </div>
        </section>

        <div className="space-y-4">
          <section className="panel p-4 space-y-3">
            <h2 className="label text-[var(--accent)]">Open taken</h2>
            {openTasks.length ? (
              <ul className="space-y-2 text-sm">
                {openTasks.map((task) => (
                  <li
                    key={task.id}
                    className="border-b border-[var(--border)] pb-2 last:border-0"
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className="block text-xs text-[var(--text-dim)]">
                      {task.dueAt?.toLocaleDateString("nl-BE") ?? "Zonder datum"}
                      {task.cadenceKey
                        ? ` · ${task.cadenceKey} stap ${task.cadenceStep ?? "?"}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-dim)]">Geen open taken.</p>
            )}
          </section>

          <section className="panel p-4 space-y-3">
            <h2 className="label text-[var(--accent)]">Taak toevoegen</h2>
            <form action={createTask} className="space-y-2">
              <input type="hidden" name="customerId" value={customer.id} />
              <input name="title" className="input" placeholder="Wat moet er gebeuren" required maxLength={200} />
              <input name="dueAt" type="datetime-local" className="input" />
              <button type="submit" className="btn w-full">
                Toevoegen aan Mijn taken
              </button>
            </form>
          </section>

          <section className="panel p-4 space-y-3">
            <h2 className="label text-[var(--accent)]">Contactpersonen</h2>
            {customer.contacts.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {customer.contacts.map((c) => (
                  <li key={c.id} className="border-b border-[var(--border)] pb-2 last:border-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{contactName(c)}</span>
                      {c.decisionMaker && <span className="badge">Beslisser</span>}
                    </div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {[contactRoleLabel(c.role), c.jobTitle].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "geen gegevens"}
                      {c.influence !== "UNKNOWN"
                        ? ` · invloed: ${CONTACT_INFLUENCE_LABELS[c.influence] ?? c.influence}`
                        : ""}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-dim)]">Nog geen contactpersoon genoteerd.</p>
            )}
            <ContactPersonForm customerId={customer.id} />
          </section>

          <section className="panel p-4 space-y-3">
            <h2 className="label text-[var(--accent)]">Automaten</h2>
            {customer.machinePlacements.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {customer.machinePlacements.map((m) => (
                  <li key={m.id} className="border-b border-[var(--border)] pb-2 last:border-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{m.model || m.product?.name || "Onbekend model"}</span>
                      <span className="badge">{machineStatusLabel(m.status)}</span>
                    </div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {[m.address, m.city].filter(Boolean).join(", ") || "geen adres"} · sinds{" "}
                      {m.placedAt.toLocaleDateString("nl-BE")}
                    </div>
                    {m.status === "ACTIVE" && (
                      <form action={markMachineRemoved} className="mt-1">
                        <input type="hidden" name="placementId" value={m.id} />
                        <input type="hidden" name="customerId" value={customer.id} />
                        <button type="submit" className="btn btn-sm btn-ghost">
                          Weghalen
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-dim)]">Nog geen automaat geregistreerd.</p>
            )}
            <MachinePlacementForm customerId={customer.id} products={products} />
          </section>
        </div>
      </div>

      <section className="panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="label text-[var(--accent)]">Geschiedenis</h2>
          <p className="text-xs text-[var(--text-dim)]">
            {counts.call} {counts.call === 1 ? "gesprek" : "gesprekken"} ·{" "}
            {counts.sent} {counts.sent === 1 ? "mail" : "mails"} ·{" "}
            {counts.document} {counts.document === 1 ? "document" : "documenten"} ·{" "}
            {counts.task} {counts.task === 1 ? "taak afgerond" : "taken afgerond"}
          </p>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Er is nog geen activiteit op de oorspronkelijke lead of klantfiche.
          </p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((item) => (
              <li
                key={item.id}
                className="border-l-2 pl-3"
                style={{ borderColor: TIMELINE_COLOURS[item.kind] ?? "var(--border)" }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-sm">{item.title}</span>
                  {item.actor && (
                    <span className="text-xs text-[var(--text-dim)]">door {item.actor}</span>
                  )}
                </div>
                {item.detail && (
                  <div className="text-sm text-[var(--text-dim)] mt-0.5">{item.detail}</div>
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
      <p className="text-sm mt-1 text-[var(--text-dim)] whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}
