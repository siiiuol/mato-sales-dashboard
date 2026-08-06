import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { idSchema } from "@/lib/validation";
import {
  approveDocument,
  markDocumentSent,
  recordDocumentSignature,
} from "@/lib/document-actions";
import { hasBlockers, type ValidationIssue } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const doc = await prisma.generatedDocument.findUnique({
    where: { id: parsed.data },
    include: {
      template: { select: { name: true, status: true, approvalSource: true } },
      customer: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      clauses: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!doc) notFound();

  const issues: ValidationIssue[] = doc.validationJson ? JSON.parse(doc.validationJson) : [];
  const blockers = issues.filter((i) => i.severity === "BLOCKER");
  const warnings = issues.filter((i) => i.severity === "WARNING");
  const blocked = hasBlockers(issues);
  const isAdmin = user.role === "admin";
  const locked = Boolean(doc.lockedAt);

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">
            <Link href="/documents" className="hover:text-[var(--accent)]">Document Studio</Link> ·{" "}
            <span className="mono">{doc.number}</span>
          </p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">{doc.title}</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {doc.templateCode} v{doc.templateVersion} · {doc.language.toUpperCase()}
            {doc.createdBy ? ` · created by ${doc.createdBy.name}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="label">Status</div>
          <div
            className={`mono text-lg ${
              doc.status === "SIGNED" || doc.status === "APPROVED" ? "text-[var(--accent)]" : ""
            }`}
          >
            {doc.status}
          </div>
          {locked && <div className="text-xs text-[var(--text-dim)]">locked · immutable</div>}
        </div>
      </div>

      <div className="mission-strip">
        <span>
          Party{" "}
          <strong>{doc.customer?.name ?? doc.supplier?.name ?? doc.lead?.name ?? "internal"}</strong>
        </span>
        <span>Clauses <strong>{doc.clauses.length}</strong></span>
        <span>Created <strong>{doc.createdAt.toLocaleDateString("nl-BE")}</strong></span>
        {doc.approvedAt && doc.approvedBy && (
          <span>
            Approved <strong>{doc.approvedBy.name} · {doc.approvedAt.toLocaleDateString("nl-BE")}</strong>
          </span>
        )}
        {doc.signedAt && (
          <span className="text-[var(--accent)]">
            Signed <strong>{doc.signerName} · {doc.signedAt.toLocaleDateString("nl-BE")}</strong>
          </span>
        )}
      </div>

      {doc.requiresExtReview && (
        <section className="panel p-4 border-[var(--warn)]">
          <h2 className="label text-[var(--warn)]">External review required</h2>
          <p className="text-sm mt-2">{doc.extReviewReason}</p>
          <p className="text-xs text-[var(--text-dim)] mt-2">
            MATO OS does not certify that a generated document is legally valid. It
            records which approved template and clause versions produced it. Have a
            specialist confirm this one before it goes out.
          </p>
        </section>
      )}

      {(blockers.length > 0 || warnings.length > 0) && (
        <section className="panel p-4 space-y-3">
          <h2 className={`label ${blockers.length ? "text-[var(--danger)]" : "text-[var(--warn)]"}`}>
            Validation · {blockers.length} blocker{blockers.length === 1 ? "" : "s"},{" "}
            {warnings.length} warning{warnings.length === 1 ? "" : "s"}
          </h2>
          <ul className="space-y-1">
            {[...blockers, ...warnings].map((issue, i) => (
              <li key={`${issue.field}-${i}`} className="text-sm flex gap-2">
                <span
                  className={`badge shrink-0 ${
                    issue.severity === "BLOCKER"
                      ? "text-[var(--danger)] border-[var(--danger)]"
                      : "text-[var(--warn)] border-[var(--warn)]"
                  }`}
                >
                  {issue.severity}
                </span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
          {blockers.length > 0 && (
            <p className="text-xs text-[var(--text-dim)]">
              Blockers prevent approval. Fix the underlying data or clause, then
              generate the document again — an approved document is never edited in
              place.
            </p>
          )}
        </section>
      )}

      <section className="panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="label text-[var(--accent)]">Document body</h2>
          <Link href={`/documents/${doc.id}/print`} className="btn py-1 min-h-0">
            Print / PDF
          </Link>
        </div>
        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{doc.body}</pre>
        {doc.clauses.length > 0 && (
          <div className="border-t border-[var(--border)] pt-3 space-y-3">
            <h3 className="label">Clauses at time of generation</h3>
            {doc.clauses.map((c) => (
              <div key={c.id}>
                <div className="mono text-xs text-[var(--text-dim)]">
                  {c.clauseCode} v{c.clauseVersion}
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.textSnapshot}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-4 space-y-3">
        <h2 className="label text-[var(--accent)]">Workflow</h2>
        <div className="flex flex-wrap items-center gap-3">
          {!locked && isAdmin && (
            <form action={approveDocument}>
              <input type="hidden" name="documentId" value={doc.id} />
              <button className="btn btn-primary" type="submit" disabled={blocked}>
                {blocked ? "Blocked by validation" : "Approve & lock"}
              </button>
            </form>
          )}
          {!isAdmin && !locked && (
            <p className="text-sm text-[var(--text-dim)]">
              Approval is an administrator action.
            </p>
          )}
          {doc.status === "APPROVED" && (
            <form action={markDocumentSent}>
              <input type="hidden" name="documentId" value={doc.id} />
              <button className="btn" type="submit">Mark as sent</button>
            </form>
          )}
          {["APPROVED", "SENT"].includes(doc.status) && (
            <form action={recordDocumentSignature} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="documentId" value={doc.id} />
              <input
                className="input w-auto"
                name="signerName"
                required
                maxLength={200}
                placeholder="Signer name"
              />
              <input className="input w-auto" name="signedAt" type="date" />
              <button className="btn" type="submit">Record signature</button>
            </form>
          )}
        </div>
        <p className="text-xs text-[var(--text-dim)]">
          Approval locks the document permanently. Signature details are recorded
          manually here; connect an e-signature provider later without changing
          this record.
        </p>
      </section>
    </div>
  );
}
