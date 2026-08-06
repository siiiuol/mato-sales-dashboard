import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createTemplate, setTemplateStatus } from "@/lib/document-actions";
import {
  DOCUMENT_CATEGORIES,
  TEMPLATE_STATUSES,
  TEMPLATE_STATUS_LABELS,
} from "@/lib/constants";
import { checkTemplateUsable } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const templates = await prisma.documentTemplate.findMany({
    orderBy: [{ code: "asc" }, { version: "desc" }],
    include: {
      approvedBy: { select: { name: true } },
      _count: { select: { documents: true } },
    },
  });
  const now = new Date();
  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">
          <Link href="/documents" className="hover:text-[var(--accent)]">Document Studio</Link> ·
          templates
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Template library</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Versioned · only approved templates can generate documents
        </p>
      </div>

      {isAdmin && (
        <details className="panel p-4">
          <summary className="label text-[var(--accent)] cursor-pointer">
            + New template (or new version of an existing code)
          </summary>
          <form action={createTemplate} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="label">Code * (e.g. QUOTE)</span>
              <input className="input" name="code" required maxLength={40} pattern="[A-Za-z0-9_-]+" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label">Name *</span>
              <input className="input" name="name" required maxLength={200} />
            </label>
            <label className="space-y-1">
              <span className="label">Number prefix * (§43)</span>
              <input className="input" name="numberPrefix" required maxLength={10} placeholder="Q / CON / PO" />
            </label>
            <label className="space-y-1">
              <span className="label">Category</span>
              <select className="select" name="category" defaultValue="SALES">
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.toLowerCase()}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Language</span>
              <select className="select" name="language" defaultValue="nl">
                {["nl", "fr", "en"].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Effective from</span>
              <input className="input" name="effectiveAt" type="date" />
            </label>
            <label className="space-y-1">
              <span className="label">Review due</span>
              <input className="input" name="reviewAt" type="date" />
            </label>
            <label className="space-y-1 sm:col-span-2 lg:col-span-4">
              <span className="label">
                Required fields — comma-separated token paths that must have a value
              </span>
              <input className="input" name="requiredFields" maxLength={1000} placeholder="customer.name, customer.address" />
            </label>
            <label className="space-y-1 sm:col-span-2 lg:col-span-4">
              <span className="label">
                Body · use {"{{customer.name}}"} style tokens
              </span>
              <textarea
                className="textarea"
                name="body"
                rows={10}
                maxLength={50000}
                placeholder={"# Offerte\n\nVoor {{customer.name}}\n{{customer.address}}, {{customer.city}}\n\nDatum: {{today}}"}
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="btn btn-primary" type="submit">Create template version</button>
            </div>
          </form>
        </details>
      )}

      <section className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Lang</th>
              <th>Prefix</th>
              <th>Used</th>
              <th>Review</th>
              <th>Status</th>
              {isAdmin && <th>Set status</th>}
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="text-[var(--text-dim)]">
                  No templates yet. Create one, then have it approved before use.
                </td>
              </tr>
            )}
            {templates.map((t) => {
              const usable = checkTemplateUsable(t, now);
              const overdue = t.reviewAt && t.reviewAt < now;
              return (
                <tr key={t.id}>
                  <td className="mono text-xs">
                    {t.code} <span className="text-[var(--text-dim)]">v{t.version}</span>
                  </td>
                  <td>
                    <div className="font-medium">{t.name}</div>
                    {t.approvalSource && (
                      <div className="text-xs text-[var(--text-dim)]">
                        approved by {t.approvalSource}
                        {t.approvedAt ? ` · ${t.approvedAt.toLocaleDateString("nl-BE")}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="mono text-xs">{t.language.toUpperCase()}</td>
                  <td className="mono text-xs">{t.numberPrefix}</td>
                  <td className="mono">{t._count.documents}</td>
                  <td className={`mono text-xs ${overdue ? "text-[var(--danger)]" : ""}`}>
                    {t.reviewAt ? t.reviewAt.toLocaleDateString("nl-BE") : "—"}
                  </td>
                  <td>
                    <span className={`badge ${usable.usable ? "badge-live" : ""}`}>
                      {TEMPLATE_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                    {!usable.usable && (
                      <div className="text-xs text-[var(--text-dim)] mt-1">{usable.reason}</div>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      <form action={setTemplateStatus} className="flex flex-wrap items-center gap-1">
                        <input type="hidden" name="templateId" value={t.id} />
                        <select className="select w-auto py-1 min-h-0 text-xs" name="status" defaultValue={t.status}>
                          {TEMPLATE_STATUSES.map((s) => (
                            <option key={s} value={s}>{TEMPLATE_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <input
                          className="input w-32 py-1 min-h-0 text-xs"
                          name="approvalSource"
                          placeholder="approved by"
                          defaultValue={t.approvalSource ?? ""}
                        />
                        <button className="btn py-1 min-h-0" type="submit">Set</button>
                      </form>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-2">Why approval is required</h2>
        <p className="text-sm text-[var(--text-dim)]">
          A template in draft, superseded, expired or blocked state cannot generate
          a document — the generator refuses before doing any work. Marking a
          template approved requires recording who approved it, so every document
          can be traced to a named sign-off. Templates approved internally only
          still flag their documents for external review.
        </p>
      </section>
    </div>
  );
}
