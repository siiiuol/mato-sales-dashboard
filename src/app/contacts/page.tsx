import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createContact, logContactTouch, setContactConsent } from "@/lib/contact-actions";
import {
  CONTACT_CONSENT,
  CONTACT_INFLUENCE,
  CONTACT_ROLES,
  contactName,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  DIRECTOR: "Director",
  PURCHASING_MANAGER: "Purchasing",
  OPERATIONS_MANAGER: "Operations",
  MARKETING_MANAGER: "Marketing",
  FACILITY_MANAGER: "Facility",
  STORE_MANAGER: "Store manager",
  PRODUCTION_MANAGER: "Production",
  FINANCE: "Finance",
  TECHNICAL: "Technical",
  GENERAL: "General",
  GATEKEEPER: "Gatekeeper",
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const filter = (await searchParams).filter ?? null;

  const where =
    filter === "decision"
      ? { decisionMaker: true }
      : filter === "followup"
        ? { nextFollowUp: { lte: new Date() } }
        : {};

  const [contacts, decisionMakers, dueFollowUps, leads, customers, suppliers] =
    await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: [{ decisionMaker: "desc" }, { updatedAt: "desc" }],
        include: {
          lead: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      }),
      prisma.contact.count({ where: { decisionMaker: true } }),
      prisma.contact.count({ where: { nextFollowUp: { lte: new Date() } } }),
      prisma.lead.findMany({
        where: { status: { notIn: ["LOST", "DO_NOT_CONTACT"] } },
        orderBy: { score: "desc" },
        take: 60,
        select: { id: true, name: true },
      }),
      prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.supplier.findMany({
        where: { status: { notIn: ["ARCHIVED"] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const now = new Date();

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Channel 14</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Contacts</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          The people behind the companies · who decides, who blocks, who to call
        </p>
      </div>

      <div className="mission-strip">
        <span>
          Total <strong>{contacts.length}</strong>
        </span>
        <span>
          Decision-makers <strong>{decisionMakers}</strong>
        </span>
        <span className={dueFollowUps > 0 ? "text-[var(--warn)]" : undefined}>
          Follow-ups due <strong>{dueFollowUps}</strong>
        </span>
        <span className="ml-auto flex gap-2">
          <Link href="/contacts" className={`badge ${!filter ? "badge-live" : ""}`}>
            all
          </Link>
          <Link
            href="/contacts?filter=decision"
            className={`badge ${filter === "decision" ? "badge-live" : ""}`}
          >
            decision-makers
          </Link>
          <Link
            href="/contacts?filter=followup"
            className={`badge ${filter === "followup" ? "badge-live" : ""}`}
          >
            follow-up due
          </Link>
        </span>
      </div>

      <details className="panel p-4">
        <summary className="label text-[var(--accent)] cursor-pointer">+ Add contact</summary>
        <form action={createContact} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="label">First name *</span>
            <input className="input" name="firstName" required maxLength={120} />
          </label>
          <label className="space-y-1">
            <span className="label">Last name</span>
            <input className="input" name="lastName" maxLength={120} />
          </label>
          <label className="space-y-1">
            <span className="label">Job title</span>
            <input className="input" name="jobTitle" maxLength={160} />
          </label>
          <label className="space-y-1">
            <span className="label">Role</span>
            <select className="select" name="role" defaultValue="GENERAL">
              {CONTACT_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Email</span>
            <input className="input" name="email" maxLength={320} />
          </label>
          <label className="space-y-1">
            <span className="label">Phone</span>
            <input className="input" name="phone" maxLength={50} />
          </label>
          <label className="space-y-1">
            <span className="label">Mobile</span>
            <input className="input" name="mobile" maxLength={50} />
          </label>
          <label className="space-y-1">
            <span className="label">WhatsApp</span>
            <input className="input" name="whatsapp" maxLength={50} />
          </label>
          <label className="space-y-1">
            <span className="label">LinkedIn</span>
            <input className="input" name="linkedin" maxLength={2048} placeholder="https://…" />
          </label>
          <label className="space-y-1">
            <span className="label">WeChat</span>
            <input className="input" name="wechat" maxLength={100} />
          </label>
          <label className="space-y-1">
            <span className="label">Language</span>
            <select className="select" name="language" defaultValue="nl">
              {["nl", "fr", "en", "zh"].map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Influence</span>
            <select className="select" name="influence" defaultValue="UNKNOWN">
              {CONTACT_INFLUENCE.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Lead</span>
            <select className="select" name="leadId" defaultValue="">
              <option value="">—</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Customer</span>
            <select className="select" name="customerId" defaultValue="">
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Supplier</span>
            <select className="select" name="supplierId" defaultValue="">
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Next follow-up</span>
            <input className="input" name="nextFollowUp" type="date" />
          </label>
          <label className="flex items-end gap-2">
            <input type="checkbox" name="decisionMaker" className="w-4 h-4" />
            <span className="text-sm">Decision-maker</span>
          </label>
          <label className="space-y-1">
            <span className="label">Consent</span>
            <select className="select" name="consent" defaultValue="UNKNOWN">
              {CONTACT_CONSENT.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-4">
            <span className="label">Notes</span>
            <textarea className="textarea" name="notes" maxLength={5000} />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button className="btn btn-primary" type="submit">Add contact</button>
          </div>
        </form>
      </details>

      {contacts.length === 0 ? (
        <section className="panel p-6 text-[var(--text-dim)]">
          {filter
            ? "No contacts match this filter."
            : "No contacts yet. Add the decision-maker behind a lead so you stop calling the switchboard."}
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contacts.map((c) => {
            const overdue = c.nextFollowUp && c.nextFollowUp <= now;
            const company = c.customer ?? c.lead ?? c.supplier;
            const companyHref = c.lead
              ? `/leads/${c.lead.id}`
              : c.supplier
                ? `/suppliers/${c.supplier.id}`
                : c.customer
                  ? "/customers"
                  : null;
            return (
              <article key={c.id} className="panel p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-lg truncate">
                      {contactName(c)}
                      {c.decisionMaker && (
                        <span className="badge badge-live ml-2">DECIDES</span>
                      )}
                    </h2>
                    <p className="text-sm text-[var(--text-dim)]">
                      {[c.jobTitle, ROLE_LABELS[c.role]].filter(Boolean).join(" · ")}
                    </p>
                    {company && companyHref && (
                      <Link href={companyHref} className="text-sm text-[var(--accent)]">
                        {company.name}
                      </Link>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="label">Influence</div>
                    <div className="mono text-sm">{c.influence}</div>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  {c.phone && (
                    <div className="telemetry-row">
                      <span>Phone</span>
                      <a href={`tel:${c.phone}`} className="text-[var(--accent)]">{c.phone}</a>
                    </div>
                  )}
                  {c.mobile && (
                    <div className="telemetry-row">
                      <span>Mobile</span>
                      <a href={`tel:${c.mobile}`} className="text-[var(--accent)]">{c.mobile}</a>
                    </div>
                  )}
                  {c.email && (
                    <div className="telemetry-row">
                      <span>Email</span>
                      <span className="truncate max-w-56">{c.email}</span>
                    </div>
                  )}
                  {c.linkedin && (
                    <div className="telemetry-row">
                      <span>LinkedIn</span>
                      <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-[var(--accent)] truncate max-w-56">
                        profile
                      </a>
                    </div>
                  )}
                  {c.wechat && (
                    <div className="telemetry-row">
                      <span>WeChat</span>
                      <span>{c.wechat}</span>
                    </div>
                  )}
                  <div className="telemetry-row">
                    <span>Last contact</span>
                    <span>
                      {c.lastContactAt ? c.lastContactAt.toLocaleDateString("nl-BE") : "never"}
                    </span>
                  </div>
                  <div className="telemetry-row">
                    <span>Next follow-up</span>
                    <span className={overdue ? "text-[var(--warn)]" : undefined}>
                      {c.nextFollowUp ? c.nextFollowUp.toLocaleDateString("nl-BE") : "—"}
                    </span>
                  </div>
                </div>

                {c.notes && (
                  <p className="text-sm text-[var(--text-dim)] whitespace-pre-wrap">{c.notes}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <form action={logContactTouch} className="flex items-center gap-2">
                    <input type="hidden" name="contactId" value={c.id} />
                    <input className="input w-auto py-1 min-h-0 text-xs" type="date" name="nextFollowUp" />
                    <button className="btn py-1 min-h-0" type="submit">Log touch</button>
                  </form>
                  <form action={setContactConsent} className="flex items-center gap-2 ml-auto">
                    <input type="hidden" name="contactId" value={c.id} />
                    <select
                      className="select w-auto py-1 min-h-0 text-xs"
                      name="consent"
                      defaultValue={c.consent}
                    >
                      {CONTACT_CONSENT.map((x) => (
                        <option key={x} value={x}>consent: {x}</option>
                      ))}
                    </select>
                    <button className="btn py-1 min-h-0" type="submit">Set</button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
