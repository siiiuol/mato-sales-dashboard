import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { idSchema } from "@/lib/validation";
import { updateSupplierScores } from "@/lib/outsourcing-actions";
import {
  formatEURUnit,
  SUPPLIER_SCORE_CAPS,
  SUPPLIER_STATUSES,
  supplierOverallScore,
} from "@/lib/constants";
import { calculateLandedCost } from "@/lib/landed-cost";

export const dynamic = "force-dynamic";

const SCORE_FIELDS = [
  { name: "qualityScore", label: "Product quality" },
  { name: "priceScore", label: "Price" },
  { name: "reliabilityScore", label: "Reliability" },
  { name: "communicationScore", label: "Communication" },
  { name: "flexibilityScore", label: "Flexibility" },
  { name: "documentationScore", label: "Documentation" },
] as const;

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const supplier = await prisma.supplier.findUnique({
    where: { id: parsed.data },
    include: {
      quotes: {
        orderBy: { createdAt: "desc" },
        include: { request: { select: { id: true, code: true, title: true, quantity: true, targetSellPrice: true } } },
      },
    },
  });
  if (!supplier) notFound();
  const score = supplierOverallScore(supplier);

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">
            <Link href="/suppliers" className="hover:text-[var(--accent)]">Suppliers</Link> · {supplier.status.replaceAll("_", " ")}
          </p>
          <h1 className="display text-3xl font-semibold mt-1">{supplier.name}</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {[supplier.platform?.replaceAll("_", " "), supplier.country, supplier.factoryType !== "UNKNOWN" ? supplier.factoryType : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <div className="label">Overall score</div>
          <div className="score text-3xl">{score.effective}</div>
          {supplier.adjustedScore != null && (
            <div className="text-xs text-[var(--text-dim)]">auto {score.auto} · human-adjusted</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 space-y-1">
          <h2 className="label text-[var(--accent)] mb-2">Profile</h2>
          <Row k="Contact" v={supplier.contactPerson} />
          <Row k="Email" v={supplier.email} />
          <Row k="Phone" v={supplier.phone} />
          <Row k="WeChat" v={supplier.wechat} />
          <Row k="WhatsApp" v={supplier.whatsapp} />
          <Row k="Store" v={supplier.storeUrl} link />
          <Row k="Website" v={supplier.website} link />
          <Row k="Categories" v={supplier.categories} />
          <Row k="Currency" v={supplier.currency} />
          <Row k="Payment terms" v={supplier.paymentTerms} />
          <Row k="MOQ" v={supplier.moq?.toString()} />
          <Row k="Lead time" v={supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : null} />
          <Row k="Sample terms" v={supplier.sampleTerms} />
          <Row k="Certifications" v={supplier.certifications} />
          {supplier.notes && (
            <p className="text-sm text-[var(--text-dim)] pt-2 whitespace-pre-wrap">{supplier.notes}</p>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="label text-[var(--accent)] mb-3">Scorecard · human reviewed</h2>
          <form action={updateSupplierScores} className="space-y-3">
            <input type="hidden" name="supplierId" value={supplier.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              {SCORE_FIELDS.map((f) => (
                <label key={f.name} className="space-y-1">
                  <span className="label">
                    {f.label} <span className="text-[var(--text-mute)]">/ {SUPPLIER_SCORE_CAPS[f.name]}</span>
                  </span>
                  <input
                    className="input"
                    name={f.name}
                    type="number"
                    min={0}
                    max={SUPPLIER_SCORE_CAPS[f.name]}
                    defaultValue={supplier[f.name]}
                    required
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Adjusted score (optional)</span>
                <input
                  className="input"
                  name="adjustedScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={supplier.adjustedScore ?? ""}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Adjustment reason</span>
                <input
                  className="input"
                  name="adjustmentReason"
                  maxLength={1000}
                  defaultValue={supplier.adjustmentReason ?? ""}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Status</span>
                <select className="select" name="status" defaultValue={supplier.status}>
                  {SUPPLIER_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Risk level</span>
                <select className="select" name="riskLevel" defaultValue={supplier.riskLevel}>
                  {["LOW", "MEDIUM", "HIGH"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button className="btn" type="submit">Save review</button>
              <span className="text-xs text-[var(--text-dim)] mono">
                last review{" "}
                {supplier.lastReviewAt
                  ? supplier.lastReviewAt.toLocaleDateString("nl-BE")
                  : "never"}
              </span>
            </div>
          </form>
        </section>
      </div>

      <section className="panel overflow-x-auto">
        <div className="p-4 pb-0">
          <h2 className="label text-[var(--accent)]">Quotes from this supplier</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Unit price</th>
              <th>MOQ</th>
              <th>Landed / unit</th>
              <th>Production</th>
              <th>Selected</th>
            </tr>
          </thead>
          <tbody>
            {supplier.quotes.length === 0 && (
              <tr>
                <td colSpan={6} className="text-[var(--text-dim)]">
                  No quotes yet. Add one from a sourcing request.
                </td>
              </tr>
            )}
            {supplier.quotes.map((q) => {
              const landed = calculateLandedCost({
                quantity: q.request.quantity,
                unitPrice: q.unitPrice,
                fxToEur: q.fxToEur,
                sampleCost: q.sampleCost,
                setupCost: q.setupCost,
                mouldCost: q.mouldCost,
                domesticShipping: q.domesticShipping,
                intlShipping: q.intlShipping,
                customsPct: q.customsPct,
                extraFees: q.extraFees,
                contingencyPct: q.contingencyPct,
              });
              return (
                <tr key={q.id}>
                  <td>
                    <Link href={`/sourcing/${q.request.id}`} className="hover:text-[var(--accent)]">
                      {q.request.code}
                    </Link>
                    <div className="text-xs text-[var(--text-dim)]">{q.request.title}</div>
                  </td>
                  <td className="mono">
                    {q.unitPrice} {q.currency}
                  </td>
                  <td className="mono">{q.moq ?? "—"}</td>
                  <td className="score">{formatEURUnit(landed.landedUnitCostEur)}</td>
                  <td className="mono text-xs">{q.productionDays ? `${q.productionDays}d` : "—"}</td>
                  <td>{q.selected ? <span className="badge badge-live">SELECTED</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({ k, v, link = false }: { k: string; v: string | null | undefined; link?: boolean }) {
  return (
    <div className="telemetry-row">
      <span>{k}</span>
      {v ? (
        link ? (
          <a href={v} target="_blank" rel="noreferrer" className="text-[var(--accent)] truncate max-w-64">
            {v}
          </a>
        ) : (
          <span className="text-right">{v}</span>
        )
      ) : (
        <span className="text-[var(--text-mute)]">—</span>
      )}
    </div>
  );
}
