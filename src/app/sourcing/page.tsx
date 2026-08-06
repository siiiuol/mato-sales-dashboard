import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createSourcingRequest } from "@/lib/outsourcing-actions";
import {
  formatEUR,
  formatEURUnit,
  SOURCING_PRIORITIES,
  supplierOverallScore,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = [
  "SUBMITTED",
  "SEARCHING",
  "QUOTES_REQUESTED",
  "QUOTES_RECEIVED",
  "SAMPLES",
  "SUPPLIER_SELECTED",
  "ORDERED",
  "IN_PRODUCTION",
  "SHIPPED",
];

const STATUS_TONE: Record<string, string> = {
  SUPPLIER_SELECTED: "text-[var(--accent)] border-[var(--accent-dim)]",
  IN_PRODUCTION: "text-[var(--warn)] border-[var(--warn)]",
  CANCELLED: "text-[var(--danger)] border-[var(--danger)]",
};

export default async function SourcingPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const [requests, suppliers, customers, deals] = await Promise.all([
    prisma.sourcingRequest.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        customer: { select: { name: true } },
        _count: { select: { quotes: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { status: { notIn: ["BLOCKED", "ARCHIVED"] } },
      select: {
        qualityScore: true,
        priceScore: true,
        reliabilityScore: true,
        communicationScore: true,
        flexibilityScore: true,
        documentationScore: true,
        adjustedScore: true,
        status: true,
      },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.deal.findMany({
      where: { stage: { notIn: ["WON", "LOST"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  const open = requests.filter((r) => OPEN_STATUSES.includes(r.status));
  const awaitingQuotes = requests.filter((r) =>
    ["SUBMITTED", "SEARCHING", "QUOTES_REQUESTED"].includes(r.status)
  ).length;
  const inProduction = requests.filter((r) =>
    ["ORDERED", "IN_PRODUCTION", "SHIPPED"].includes(r.status)
  ).length;
  const approvedSuppliers = suppliers.filter((s) =>
    ["APPROVED", "PREFERRED"].includes(s.status)
  ).length;
  const avgScore = suppliers.length
    ? Math.round(
        suppliers.reduce((sum, s) => sum + supplierOverallScore(s).effective, 0) /
          suppliers.length
      )
    : 0;
  const targetValue = open.reduce(
    (sum, r) => sum + (r.targetSellPrice ?? 0) * r.quantity,
    0
  );

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Channel 11</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Sourcing</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Outsourcing workspace · find the best price, quality and margin
        </p>
      </div>

      <div className="mission-strip">
        <span>
          Open requests <strong>{open.length}</strong>
        </span>
        <span>
          Awaiting quotes <strong>{awaitingQuotes}</strong>
        </span>
        <span>
          In production <strong>{inProduction}</strong>
        </span>
        <span>
          Approved suppliers <strong>{approvedSuppliers}</strong>
        </span>
        <span>
          Avg supplier score <strong>{avgScore}</strong>
        </span>
        <span className="ml-auto">
          Target sell value <strong>{formatEUR(targetValue)}</strong>
        </span>
      </div>

      <details className="panel p-4">
        <summary className="label text-[var(--accent)] cursor-pointer">
          + New sourcing request
        </summary>
        <form action={createSourcingRequest} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="label">What are we sourcing? *</span>
            <input
              className="input"
              name="title"
              required
              maxLength={300}
              placeholder="Custom printed noodle box with handle"
            />
          </label>
          <label className="space-y-1">
            <span className="label">Category</span>
            <select className="select" name="category" defaultValue="PACKAGING">
              {["PACKAGING", "MACHINE", "MACHINE_PART", "BRANDING", "OTHER"].map((c) => (
                <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Quantity</span>
            <input className="input" name="quantity" type="number" min={0} placeholder="5000" />
          </label>
          <label className="space-y-1">
            <span className="label">Target cost / unit (EUR)</span>
            <input className="input" name="targetUnitCost" type="number" step="0.01" min={0} />
          </label>
          <label className="space-y-1">
            <span className="label">Target sell price / unit (EUR)</span>
            <input className="input" name="targetSellPrice" type="number" step="0.01" min={0} />
          </label>
          <label className="space-y-1">
            <span className="label">Required margin %</span>
            <input className="input" name="requiredMarginPct" type="number" step="1" min={0} max={99} />
          </label>
          <label className="space-y-1">
            <span className="label">Max MOQ</span>
            <input className="input" name="maxMoq" type="number" min={0} />
          </label>
          <label className="space-y-1">
            <span className="label">Needed by</span>
            <input className="input" name="requiredBy" type="date" />
          </label>
          <label className="space-y-1">
            <span className="label">Priority</span>
            <select className="select" name="priority" defaultValue="NORMAL">
              {SOURCING_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Customer</span>
            <select className="select" name="customerId" defaultValue="">
              <option value="">— internal / stock —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Linked deal</span>
            <select className="select" name="dealId" defaultValue="">
              <option value="">—</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Dimensions</span>
            <input className="input" name="dimensions" maxLength={300} placeholder="180×120×80 mm" />
          </label>
          <label className="space-y-1">
            <span className="label">Materials</span>
            <input className="input" name="materials" maxLength={300} placeholder="Kraft 350gsm, PE-free" />
          </label>
          <label className="space-y-1">
            <span className="label">Printing</span>
            <input className="input" name="printing" maxLength={300} placeholder="2-colour logo" />
          </label>
          <label className="space-y-1 flex items-end gap-2">
            <input type="checkbox" name="sampleRequired" defaultChecked className="w-4 h-4" />
            <span className="text-sm">Sample required before order</span>
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="label">Description / reference URLs</span>
            <textarea className="textarea" name="description" maxLength={5000} />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="btn btn-primary" type="submit">Create request</button>
          </div>
        </form>
      </details>

      <section className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Request</th>
              <th>Qty</th>
              <th>Target cost</th>
              <th>Quotes</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="text-[var(--text-dim)]">
                  No sourcing requests yet. Create the first one above.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="mono text-xs">
                  <Link href={`/sourcing/${r.id}`} className="hover:text-[var(--accent)]">
                    {r.code}
                  </Link>
                </td>
                <td>
                  <Link href={`/sourcing/${r.id}`} className="hover:text-[var(--accent)] font-medium">
                    {r.title}
                  </Link>
                  <div className="text-xs text-[var(--text-dim)]">
                    {r.customer?.name ?? "internal"}
                  </div>
                </td>
                <td className="mono">{r.quantity || "—"}</td>
                <td className="mono">
                  {r.targetUnitCost != null ? formatEURUnit(r.targetUnitCost) : "—"}
                </td>
                <td className="mono">{r._count.quotes}</td>
                <td>
                  <span className={`badge ${r.priority === "URGENT" ? "text-[var(--danger)] border-[var(--danger)]" : r.priority === "HIGH" ? "text-[var(--warn)] border-[var(--warn)]" : ""}`}>
                    {r.priority}
                  </span>
                </td>
                <td>
                  <span className={`badge ${STATUS_TONE[r.status] ?? ""}`}>
                    {r.status.replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
