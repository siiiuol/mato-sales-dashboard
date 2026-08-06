import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createClause, setClauseStatus } from "@/lib/document-actions";
import { CLAUSE_CATEGORIES, CLAUSE_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const APPROVED = ["MATO_APPROVED", "ACCOUNTANT_APPROVED", "LEGAL_APPROVED"];

export default async function ClausesPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const clauses = await prisma.clause.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }, { version: "desc" }],
  });
  const isAdmin = user.role === "admin";
  const approved = clauses.filter((c) => APPROVED.includes(c.status));
  const drafts = clauses.filter((c) => c.status === "DRAFT");
  const highRisk = clauses.filter((c) => c.riskLevel === "HIGH");

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">
          <Link href="/documents" className="hover:text-[var(--accent)]">Document Studio</Link> ·
          clauses
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Clause library</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Approved legal building blocks · commercial options, not rewritten law
        </p>
      </div>

      <div className="mission-strip">
        <span>Clauses <strong>{clauses.length}</strong></span>
        <span>Approved <strong>{approved.length}</strong></span>
        <span className={drafts.length > 0 ? "text-[var(--warn)]" : undefined}>
          Draft <strong>{drafts.length}</strong>
        </span>
        <span className={highRisk.length > 0 ? "text-[var(--warn)]" : undefined}>
          High risk <strong>{highRisk.length}</strong>
        </span>
      </div>

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-2">Before you fill these in</h2>
        <p className="text-sm text-[var(--text-dim)]">
          The clause text below is deliberately empty. MATO OS ships the structure
          — the categories, versioning, approval states and review dates — but not
          the wording, because binding payment, warranty and liability terms for a
          Belgian company should come from your accountant or legal adviser, not
          from generated text. Paste their wording in, record who reviewed it, and
          only then approve. A clause that is still a draft blocks document
          approval by design.
        </p>
      </section>

      {isAdmin && (
        <details className="panel p-4">
          <summary className="label text-[var(--accent)] cursor-pointer">
            + New clause (or new version of an existing code)
          </summary>
          <form action={createClause} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="label">Code *</span>
              <input className="input" name="code" required maxLength={40} pattern="[A-Za-z0-9_-]+" placeholder="PAY-01" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label">Title *</span>
              <input className="input" name="title" required maxLength={200} />
            </label>
            <label className="space-y-1">
              <span className="label">Category</span>
              <select className="select" name="category" defaultValue="PAYMENT_TERMS">
                {CLAUSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replaceAll("_", " ").toLowerCase()}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Risk level</span>
              <select className="select" name="riskLevel" defaultValue="MEDIUM">
                {["LOW", "MEDIUM", "HIGH"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Reviewer</span>
              <input className="input" name="reviewer" maxLength={200} placeholder="Accountant / legal adviser" />
            </label>
            <label className="space-y-1">
              <span className="label">Review due</span>
              <input className="input" name="reviewAt" type="date" />
            </label>
            <label className="flex items-end gap-2">
              <input type="checkbox" name="mandatory" className="w-4 h-4" />
              <span className="text-sm">Mandatory clause</span>
            </label>
            <label className="space-y-1 sm:col-span-2 lg:col-span-4">
              <span className="label">Dutch text</span>
              <textarea className="textarea" name="textNl" rows={4} maxLength={20000} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label">French text</span>
              <textarea className="textarea" name="textFr" rows={3} maxLength={20000} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label">English text</span>
              <textarea className="textarea" name="textEn" rows={3} maxLength={20000} />
            </label>
            <label className="space-y-1 sm:col-span-2 lg:col-span-4">
              <span className="label">Internal explanation (why this clause exists)</span>
              <textarea className="textarea" name="explanation" rows={2} maxLength={2000} />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="btn btn-primary" type="submit">Create clause version</button>
            </div>
          </form>
        </details>
      )}

      {clauses.length === 0 ? (
        <section className="panel p-6 text-[var(--text-dim)]">
          No clauses yet. Start with the ones you use most: payment terms, deposit,
          ownership reservation, warranty, applicable law.
        </section>
      ) : (
        <section className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Category</th>
                <th>Languages</th>
                <th>Risk</th>
                <th>Reviewer</th>
                <th>Status</th>
                {isAdmin && <th>Set status</th>}
              </tr>
            </thead>
            <tbody>
              {clauses.map((c) => {
                const langs = [
                  c.textNl.trim() ? "NL" : null,
                  c.textFr.trim() ? "FR" : null,
                  c.textEn.trim() ? "EN" : null,
                ].filter(Boolean);
                return (
                  <tr key={c.id}>
                    <td className="mono text-xs">
                      {c.code} <span className="text-[var(--text-dim)]">v{c.version}</span>
                      {c.mandatory && <div className="badge mt-1">mandatory</div>}
                    </td>
                    <td>{c.title}</td>
                    <td className="text-xs">{c.category.replaceAll("_", " ").toLowerCase()}</td>
                    <td className="mono text-xs">
                      {langs.length ? langs.join(" ") : (
                        <span className="text-[var(--danger)]">none</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          c.riskLevel === "HIGH" ? "text-[var(--warn)] border-[var(--warn)]" : ""
                        }`}
                      >
                        {c.riskLevel}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--text-dim)]">{c.reviewer ?? "—"}</td>
                    <td>
                      <span className={`badge ${APPROVED.includes(c.status) ? "badge-live" : ""}`}>
                        {c.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <form action={setClauseStatus} className="flex flex-wrap items-center gap-1">
                          <input type="hidden" name="clauseId" value={c.id} />
                          <select className="select w-auto py-1 min-h-0 text-xs" name="status" defaultValue={c.status}>
                            {CLAUSE_STATUSES.map((s) => (
                              <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
                            ))}
                          </select>
                          <input
                            className="input w-28 py-1 min-h-0 text-xs"
                            name="reviewer"
                            placeholder="reviewer"
                            defaultValue={c.reviewer ?? ""}
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
      )}
    </div>
  );
}
