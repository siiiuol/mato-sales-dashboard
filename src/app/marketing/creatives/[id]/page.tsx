import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { idSchema } from "@/lib/validation";
import {
  addCreativeVersion,
  approveCreative,
  requestCreativeRevision,
  setCreativeStatus,
} from "@/lib/marketing-actions";
import { CREATIVE_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CreativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const [request, users] = await Promise.all([
    prisma.creativeRequest.findUnique({
      where: { id: parsed.data },
      include: {
        campaign: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
        product: { select: { id: true, name: true } },
        requestedBy: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
        approvedBy: { select: { name: true } },
        versions: {
          orderBy: { version: "desc" },
          include: { createdBy: { select: { name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!request) notFound();

  const latest = request.versions[0];
  const canApprove = user.role === "admin";

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">
            <Link href="/marketing" className="hover:text-[var(--accent)]">Marketing</Link> ·{" "}
            <span className="mono">{request.code}</span>
          </p>
          <h1 className="display text-3xl font-semibold mt-1">{request.title}</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {request.type.replaceAll("_", " ").toLowerCase()}
            {request.requestedBy ? ` · requested by ${request.requestedBy.name}` : ""}
            {request.assignedTo ? ` · assigned to ${request.assignedTo.name}` : " · unassigned"}
          </p>
        </div>
        <div className="text-right">
          <div className="label">Status</div>
          <div className={`mono text-lg ${request.status === "APPROVED" ? "text-[var(--accent)]" : ""}`}>
            {request.status.replaceAll("_", " ")}
          </div>
          {request.approvedAt && request.approvedBy && (
            <div className="text-xs text-[var(--text-dim)]">
              by {request.approvedBy.name} · {request.approvedAt.toLocaleDateString("nl-BE")}
            </div>
          )}
        </div>
      </div>

      <div className="mission-strip">
        <span>
          Deadline{" "}
          <strong>{request.deadline ? request.deadline.toLocaleDateString("nl-BE") : "—"}</strong>
        </span>
        <span>Priority <strong>{request.priority}</strong></span>
        <span>Language <strong>{request.language.toUpperCase()}</strong></span>
        <span>Versions <strong>{request.versions.length}</strong></span>
        {request.platform && <span>Platform <strong>{request.platform}</strong></span>}
        {request.dimensions && <span>Size <strong>{request.dimensions}</strong></span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 space-y-3">
          <h2 className="label text-[var(--accent)]">Brief</h2>
          {request.objective && (
            <div>
              <div className="label">Objective</div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{request.objective}</p>
            </div>
          )}
          {request.mainMessage && (
            <div>
              <div className="label">Main message</div>
              <p className="text-sm mt-1">{request.mainMessage}</p>
            </div>
          )}
          {request.cta && (
            <div>
              <div className="label">Call to action</div>
              <p className="text-sm mt-1">{request.cta}</p>
            </div>
          )}
          {request.audience && (
            <div>
              <div className="label">Audience</div>
              <p className="text-sm mt-1">{request.audience}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {request.campaign && (
              <span className="badge">campaign: {request.campaign.name}</span>
            )}
            {request.customer && <span className="badge">customer: {request.customer.name}</span>}
            {request.product && <span className="badge">product: {request.product.name}</span>}
            {request.deal && <span className="badge">deal: {request.deal.title}</span>}
          </div>
          <p className="text-xs text-[var(--text-dim)] pt-2">
            Product claims must come from the approved catalogue — the brief never
            invents specifications, capacity or warranty terms.
          </p>
        </section>

        <section className="panel p-4 space-y-4">
          <h2 className="label text-[var(--accent)]">Workflow</h2>

          <form action={setCreativeStatus} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="requestId" value={request.id} />
            <label className="space-y-1 flex-1 min-w-40">
              <span className="label">Status</span>
              <select className="select" name="status" defaultValue={request.status}>
                {CREATIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 flex-1 min-w-40">
              <span className="label">Assign</span>
              <select className="select" name="assignedToId" defaultValue={request.assignedTo?.id ?? ""}>
                <option value="">— keep —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit">Update</button>
          </form>

          <form action={addCreativeVersion} className="space-y-2 border-t border-[var(--border)] pt-3">
            <input type="hidden" name="requestId" value={request.id} />
            <p className="label">Deliver a version</p>
            <input className="input" name="fileUrl" maxLength={2048} placeholder="Link to the file (Drive, Figma…)" />
            <textarea className="textarea" name="summary" maxLength={2000} placeholder="What changed in this version" />
            <button className="btn" type="submit">Add version</button>
            <p className="text-xs text-[var(--text-dim)]">
              A new version clears any previous approval — it has not been reviewed yet.
            </p>
          </form>

          <div className="border-t border-[var(--border)] pt-3 space-y-2">
            <p className="label">Approval</p>
            {!latest ? (
              <p className="text-sm text-[var(--text-dim)]">
                Nothing to approve yet — add a version first.
              </p>
            ) : canApprove ? (
              <div className="flex flex-wrap gap-2">
                <form action={approveCreative}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="btn btn-primary" type="submit" disabled={request.status === "APPROVED"}>
                    {request.status === "APPROVED" ? "Approved" : `Approve v${latest.version}`}
                  </button>
                </form>
                <form action={requestCreativeRevision} className="flex items-center gap-2 flex-1">
                  <input type="hidden" name="requestId" value={request.id} />
                  <input className="input" name="feedback" required maxLength={2000} placeholder="What needs to change" />
                  <button className="btn btn-danger" type="submit">Request revision</button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-dim)]">
                Approval is a manager action. Ask an administrator to sign off.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="panel p-4 space-y-3">
        <h2 className="label text-[var(--accent)]">Version history</h2>
        {request.versions.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">No versions delivered yet.</p>
        ) : (
          <ul className="space-y-3">
            {request.versions.map((v) => (
              <li key={v.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    v{v.version}
                    {v.version === latest?.version && (
                      <span className="badge badge-live ml-2">LATEST</span>
                    )}
                  </span>
                  <span className="mono text-xs text-[var(--text-dim)]">
                    {v.createdBy?.name ?? "—"} · {v.createdAt.toLocaleDateString("nl-BE")}
                  </span>
                </div>
                {v.summary && <p className="text-sm mt-1">{v.summary}</p>}
                {v.fileUrl && (
                  <a href={v.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent)]">
                    open file
                  </a>
                )}
                {v.feedback && (
                  <p className="text-sm text-[var(--warn)] mt-1">Revision note: {v.feedback}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
