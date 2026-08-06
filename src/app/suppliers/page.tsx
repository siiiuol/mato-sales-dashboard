import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createSupplier } from "@/lib/outsourcing-actions";
import { supplierOverallScore } from "@/lib/constants";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  PREFERRED: "text-[var(--accent)] border-[var(--accent-dim)]",
  APPROVED: "text-[var(--accent)] border-[var(--accent-dim)]",
  RESTRICTED: "text-[var(--warn)] border-[var(--warn)]",
  BLOCKED: "text-[var(--danger)] border-[var(--danger)]",
};

export default async function SuppliersPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const suppliers = await prisma.supplier.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { quotes: true } } },
  });

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Channel 12</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Suppliers</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Sourcing partners · scored on quality, price, reliability, communication
        </p>
      </div>

      <details className="panel p-4">
        <summary className="label text-[var(--accent)] cursor-pointer">
          + Register supplier
        </summary>
        <form action={createSupplier} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="label">Name *</span>
            <input className="input" name="name" required maxLength={300} />
          </label>
          <label className="space-y-1">
            <span className="label">Platform</span>
            <select className="select" name="platform" defaultValue="">
              <option value="">—</option>
              {["ALIBABA", "1688", "TAOBAO", "WEIDIAN", "MADE_IN_CHINA", "GLOBAL_SOURCES", "EU_SUPPLIER", "DIRECT"].map((p) => (
                <option key={p} value={p}>{p.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Store / website</span>
            <input className="input" name="storeUrl" maxLength={2048} placeholder="https://…" />
          </label>
          <label className="space-y-1">
            <span className="label">Contact person</span>
            <input className="input" name="contactPerson" maxLength={200} />
          </label>
          <label className="space-y-1">
            <span className="label">Email</span>
            <input className="input" name="email" maxLength={320} />
          </label>
          <label className="space-y-1">
            <span className="label">WeChat</span>
            <input className="input" name="wechat" maxLength={100} />
          </label>
          <label className="space-y-1">
            <span className="label">Country</span>
            <input className="input" name="country" defaultValue="China" maxLength={100} />
          </label>
          <label className="space-y-1">
            <span className="label">Factory or trader</span>
            <select className="select" name="factoryType" defaultValue="UNKNOWN">
              <option value="UNKNOWN">Unknown</option>
              <option value="FACTORY">Factory</option>
              <option value="TRADER">Trader</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Currency</span>
            <select className="select" name="currency" defaultValue="USD">
              {["USD", "CNY", "EUR"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Categories</span>
            <input className="input" name="categories" maxLength={500} placeholder="noodle boxes, cups, bags…" />
          </label>
          <label className="space-y-1">
            <span className="label">MOQ</span>
            <input className="input" name="moq" type="number" min={0} />
          </label>
          <label className="space-y-1">
            <span className="label">Lead time (days)</span>
            <input className="input" name="leadTimeDays" type="number" min={0} />
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="label">Notes</span>
            <textarea className="textarea" name="notes" maxLength={5000} />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="btn btn-primary" type="submit">Create supplier</button>
          </div>
        </form>
      </details>

      <section className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Platform</th>
              <th>Country</th>
              <th>Categories</th>
              <th>Quotes</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-[var(--text-dim)]">
                  No suppliers yet. Register the first one above.
                </td>
              </tr>
            )}
            {suppliers.map((s) => {
              const score = supplierOverallScore(s);
              return (
                <tr key={s.id}>
                  <td>
                    <Link href={`/suppliers/${s.id}`} className="hover:text-[var(--accent)] font-medium">
                      {s.name}
                    </Link>
                    <div className="text-xs text-[var(--text-dim)]">
                      {s.contactPerson ?? "—"}
                    </div>
                  </td>
                  <td className="mono text-xs">{s.platform?.replaceAll("_", " ") ?? "—"}</td>
                  <td className="text-sm">{s.country}</td>
                  <td className="text-sm text-[var(--text-dim)] max-w-56 truncate">
                    {s.categories ?? "—"}
                  </td>
                  <td className="mono">{s._count.quotes}</td>
                  <td>
                    <span className="score">{score.effective}</span>
                    {s.adjustedScore != null && (
                      <span className="text-xs text-[var(--text-dim)]"> (auto {score.auto})</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_TONE[s.status] ?? ""}`}>
                      {s.status.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
