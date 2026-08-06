import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { generateDocument } from "@/lib/document-actions";
import { TEMPLATE_STATUS_LABELS } from "@/lib/constants";
import { checkTemplateUsable } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const now = new Date();

  const [documents, templates, clauses, customers, suppliers] = await Promise.all([
    prisma.generatedDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        lead: { select: { name: true } },
      },
    }),
    prisma.documentTemplate.findMany({ orderBy: [{ code: "asc" }, { version: "desc" }] }),
    prisma.clause.findMany({ orderBy: [{ code: "asc" }, { version: "desc" }] }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({
      where: { status: { notIn: ["ARCHIVED"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const usableTemplates = templates.filter((t) => checkTemplateUsable(t, now).usable);
  const approvedClauses = clauses.filter((c) =>
    ["MATO_APPROVED", "ACCOUNTANT_APPROVED", "LEGAL_APPROVED"].includes(c.status)
  );
  const awaitingApproval = documents.filter((d) =>
    ["DRAFT", "VALIDATED"].includes(d.status)
  );
  const awaitingSignature = documents.filter((d) => ["APPROVED", "SENT"].includes(d.status));
  const needExtReview = documents.filter((d) => d.requiresExtReview && !d.approvedAt);
  const templatesNeedingReview = templates.filter(
    (t) => t.reviewAt && t.reviewAt < now && t.status !== "BLOCKED"
  );

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Channel 16</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Document Studio</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Nobody starts from a blank page · approved templates, approved clauses
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/documents/templates" className="btn">Templates ({templates.length})</Link>
          <Link href="/documents/clauses" className="btn">Clauses ({clauses.length})</Link>
        </div>
      </div>

      <div className="mission-strip">
        <span>Documents <strong>{documents.length}</strong></span>
        <span className={awaitingApproval.length > 0 ? "text-[var(--warn)]" : undefined}>
          Awaiting approval <strong>{awaitingApproval.length}</strong>
        </span>
        <span>Awaiting signature <strong>{awaitingSignature.length}</strong></span>
        <span className={needExtReview.length > 0 ? "text-[var(--warn)]" : undefined}>
          Need external review <strong>{needExtReview.length}</strong>
        </span>
        <span>Usable templates <strong>{usableTemplates.length}</strong></span>
        <span className={templatesNeedingReview.length > 0 ? "text-[var(--danger)]" : undefined}>
          Templates overdue review <strong>{templatesNeedingReview.length}</strong>
        </span>
      </div>

      <section className="panel p-4 space-y-3">
        <h2 className="label text-[var(--accent)]">Generate a document</h2>
        {usableTemplates.length === 0 ? (
          <div className="text-sm text-[var(--text-dim)] space-y-2">
            <p>
              No template is approved for use yet. A template must reach MATO,
              accountant or legal approval before it can generate anything — that is
              the point of the compliance layer, not a bug.
            </p>
            <Link href="/documents/templates" className="btn">Set up templates →</Link>
          </div>
        ) : (
          <form action={generateDocument} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="label">Template *</span>
              <select className="select" name="templateId" required defaultValue="">
                <option value="" disabled>choose…</option>
                {usableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} v{t.version} · {t.name}
                  </option>
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
              <span className="label">Title override</span>
              <input className="input" name="title" maxLength={300} />
            </label>
            {approvedClauses.length > 0 && (
              <label className="space-y-1 sm:col-span-2 lg:col-span-4">
                <span className="label">
                  Clauses to include — approved only (ctrl-click for several)
                </span>
                <select className="select" name="clauseIds" multiple size={Math.min(5, approvedClauses.length)}>
                  {approvedClauses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} v{c.version} · {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="btn btn-primary" type="submit">
                Generate · number is assigned automatically
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="panel overflow-x-auto">
        <div className="p-4 pb-0">
          <h2 className="label text-[var(--accent)]">Generated documents</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Title</th>
              <th>Template</th>
              <th>Party</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="text-[var(--text-dim)]">
                  No documents generated yet.
                </td>
              </tr>
            )}
            {documents.map((d) => (
              <tr key={d.id}>
                <td className="mono text-xs">
                  <Link href={`/documents/${d.id}`} className="hover:text-[var(--accent)]">
                    {d.number}
                  </Link>
                </td>
                <td>
                  <Link href={`/documents/${d.id}`} className="hover:text-[var(--accent)]">
                    {d.title}
                  </Link>
                  {d.requiresExtReview && !d.approvedAt && (
                    <span className="badge text-[var(--warn)] border-[var(--warn)] ml-2">
                      EXT REVIEW
                    </span>
                  )}
                </td>
                <td className="mono text-xs">
                  {d.templateCode} v{d.templateVersion}
                </td>
                <td className="text-sm text-[var(--text-dim)]">
                  {d.customer?.name ?? d.supplier?.name ?? d.lead?.name ?? "—"}
                </td>
                <td className="mono text-xs">{d.createdAt.toLocaleDateString("nl-BE")}</td>
                <td>
                  <span
                    className={`badge ${
                      d.status === "SIGNED" || d.status === "APPROVED" ? "badge-live" : ""
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-2">Compliance register</h2>
        <p className="text-sm text-[var(--text-dim)]">
          MATO OS never claims a generated document is legally guaranteed. Each
          document stores the template code and version it came from, who approved
          that template and when, and the exact clause text used at generation time.
          Manual clause edits and high-risk clauses automatically flag the document
          for external review.
        </p>
        {templatesNeedingReview.length > 0 && (
          <ul className="mt-3 space-y-1">
            {templatesNeedingReview.map((t) => (
              <li key={t.id} className="text-sm flex justify-between gap-2">
                <span>
                  {t.code} v{t.version} · {t.name}{" "}
                  <span className="badge">{TEMPLATE_STATUS_LABELS[t.status]}</span>
                </span>
                <span className="mono text-xs text-[var(--danger)]">
                  review was due {t.reviewAt?.toLocaleDateString("nl-BE")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
