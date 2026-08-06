import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { idSchema } from "@/lib/validation";
import {
  addSupplierQuote,
  selectSupplierQuote,
  updateSourcingStatus,
} from "@/lib/outsourcing-actions";
import {
  formatEUR,
  formatEURUnit,
  SOURCING_STATUSES,
  supplierOverallScore,
} from "@/lib/constants";
import { calculateLandedCost } from "@/lib/landed-cost";

export const dynamic = "force-dynamic";

export default async function SourcingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const [request, suppliers] = await Promise.all([
    prisma.sourcingRequest.findUnique({
      where: { id: parsed.data },
      include: {
        customer: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
        requestedBy: { select: { name: true } },
        quotes: {
          orderBy: { createdAt: "asc" },
          include: { supplier: true },
        },
      },
    }),
    prisma.supplier.findMany({
      where: { status: { notIn: ["BLOCKED", "ARCHIVED"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currency: true },
    }),
  ]);
  if (!request) notFound();

  const rows = request.quotes.map((q) => {
    const landed = calculateLandedCost({
      quantity: request.quantity,
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
      targetSellPrice: request.targetSellPrice,
    });
    const meetsMargin =
      request.requiredMarginPct == null || landed.grossMarginPct == null
        ? null
        : landed.grossMarginPct >= request.requiredMarginPct;
    const meetsMoq =
      request.maxMoq == null || q.moq == null ? null : q.moq <= request.maxMoq;
    return { quote: q, landed, meetsMargin, meetsMoq };
  });

  const eligible = rows.filter(
    (r) => r.meetsMargin !== false && r.meetsMoq !== false && request.quantity > 0
  );
  const recommended =
    (eligible.length ? eligible : rows).length > 0
      ? [...(eligible.length ? eligible : rows)].sort(
          (a, b) => a.landed.landedUnitCostEur - b.landed.landedUnitCostEur
        )[0]?.quote.id
      : null;

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">
            <Link href="/sourcing" className="hover:text-[var(--accent)]">Sourcing</Link>{" "}
            · <span className="mono">{request.code}</span>
          </p>
          <h1 className="display text-3xl font-semibold mt-1">{request.title}</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {request.customer ? (
              <>for {request.customer.name}</>
            ) : (
              "internal / stock"
            )}
            {request.deal ? <> · deal “{request.deal.title}”</> : null}
            {request.requestedBy ? <> · requested by {request.requestedBy.name}</> : null}
          </p>
        </div>
        <form action={updateSourcingStatus} className="flex items-center gap-2">
          <input type="hidden" name="requestId" value={request.id} />
          <select className="select" name="status" defaultValue={request.status}>
            {SOURCING_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
            ))}
          </select>
          <button className="btn" type="submit">Set status</button>
        </form>
      </div>

      <div className="mission-strip">
        <span>Qty <strong>{request.quantity || "—"}</strong></span>
        <span>
          Target cost{" "}
          <strong>{request.targetUnitCost != null ? formatEURUnit(request.targetUnitCost) : "—"}</strong>
        </span>
        <span>
          Target sell{" "}
          <strong>{request.targetSellPrice != null ? formatEURUnit(request.targetSellPrice) : "—"}</strong>
        </span>
        <span>
          Required margin{" "}
          <strong>{request.requiredMarginPct != null ? `${request.requiredMarginPct}%` : "—"}</strong>
        </span>
        <span>Max MOQ <strong>{request.maxMoq ?? "—"}</strong></span>
        <span>
          Needed by{" "}
          <strong>{request.requiredBy ? request.requiredBy.toLocaleDateString("nl-BE") : "—"}</strong>
        </span>
        <span className="ml-auto">
          Sample <strong>{request.sampleRequired ? "required" : "optional"}</strong>
        </span>
      </div>

      {(request.dimensions || request.materials || request.printing || request.description) && (
        <section className="panel p-4 grid gap-2 sm:grid-cols-3">
          {request.dimensions && <div><div className="label">Dimensions</div><div className="text-sm mt-1">{request.dimensions}</div></div>}
          {request.materials && <div><div className="label">Materials</div><div className="text-sm mt-1">{request.materials}</div></div>}
          {request.printing && <div><div className="label">Printing</div><div className="text-sm mt-1">{request.printing}</div></div>}
          {request.description && (
            <div className="sm:col-span-3">
              <div className="label">Brief</div>
              <p className="text-sm mt-1 text-[var(--text-dim)] whitespace-pre-wrap">{request.description}</p>
            </div>
          )}
        </section>
      )}

      <section className="panel overflow-x-auto">
        <div className="p-4 pb-0 flex items-center justify-between">
          <h2 className="label text-[var(--accent)]">
            Supplier comparison · landed cost per unit
          </h2>
          <span className="text-xs text-[var(--text-dim)]">
            recommendation is advisory — selection stays human
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Unit price</th>
              <th>MOQ</th>
              <th>Prod.</th>
              <th>Landed / unit</th>
              <th>Order total</th>
              <th>Margin</th>
              <th>Score</th>
              <th>Fit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-[var(--text-dim)]">
                  No supplier quotes yet. Add the first quote below.
                </td>
              </tr>
            )}
            {rows.map(({ quote: q, landed, meetsMargin, meetsMoq }) => (
              <tr
                key={q.id}
                className={q.selected ? "bg-[rgba(61,255,154,0.05)]" : undefined}
              >
                <td>
                  <Link href={`/suppliers/${q.supplier.id}`} className="hover:text-[var(--accent)] font-medium">
                    {q.supplier.name}
                  </Link>
                  <div className="text-xs text-[var(--text-dim)]">
                    {q.selected && <span className="badge badge-live mr-1">SELECTED</span>}
                    {recommended === q.id && !q.selected && (
                      <span className="badge mr-1 text-[var(--accent)] border-[var(--accent-dim)]">RECOMMENDED</span>
                    )}
                    {q.title ?? ""}
                  </div>
                </td>
                <td className="mono">
                  {q.unitPrice} {q.currency}
                  {q.currency !== "EUR" && (
                    <div className="text-xs text-[var(--text-dim)]">
                      ≈ {formatEURUnit(q.unitPrice * q.fxToEur)}
                    </div>
                  )}
                </td>
                <td className="mono">{q.moq ?? "—"}</td>
                <td className="mono text-xs">{q.productionDays ? `${q.productionDays}d` : "—"}</td>
                <td className="score">{formatEURUnit(landed.landedUnitCostEur)}</td>
                <td className="mono text-sm">{formatEUR(landed.totalOrderCostEur)}</td>
                <td>
                  {landed.grossMarginPct == null ? (
                    <span className="text-[var(--text-mute)]">—</span>
                  ) : (
                    <span className={landed.grossMarginPct >= (request.requiredMarginPct ?? 0) ? "score" : "text-[var(--danger)] mono"}>
                      {landed.grossMarginPct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="mono">{supplierOverallScore(q.supplier).effective}</td>
                <td className="text-xs">
                  {meetsMargin === false && <div className="text-[var(--danger)]">margin ✗</div>}
                  {meetsMoq === false && <div className="text-[var(--danger)]">MOQ ✗</div>}
                  {meetsMargin !== false && meetsMoq !== false && (
                    <span className="text-[var(--accent)]">ok</span>
                  )}
                </td>
                <td>
                  {!q.selected && user.role === "admin" && (
                    <form action={selectSupplierQuote}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="quoteId" value={q.id} />
                      <button className="btn py-1 min-h-0" type="submit">
                        Select
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <details className="panel p-4" open={request.quotes.length === 0}>
        <summary className="label text-[var(--accent)] cursor-pointer">
          + Add supplier quote
        </summary>
        {suppliers.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)] mt-3">
            No suppliers registered yet —{" "}
            <Link href="/suppliers" className="text-[var(--accent)]">create one first</Link>.
          </p>
        ) : (
          <form action={addSupplierQuote} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="requestId" value={request.id} />
            <label className="space-y-1">
              <span className="label">Supplier *</span>
              <select className="select" name="supplierId" required defaultValue="">
                <option value="" disabled>choose…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Unit price *</span>
              <input className="input" name="unitPrice" type="number" step="0.0001" min={0} required />
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
              <span className="label">FX → EUR</span>
              <input className="input" name="fxToEur" type="number" step="0.0001" min={0.0001} defaultValue="0.92" />
            </label>
            <label className="space-y-1">
              <span className="label">MOQ</span>
              <input className="input" name="moq" type="number" min={0} />
            </label>
            <label className="space-y-1">
              <span className="label">Production days</span>
              <input className="input" name="productionDays" type="number" min={0} />
            </label>
            <label className="space-y-1">
              <span className="label">Sample cost</span>
              <input className="input" name="sampleCost" type="number" step="0.01" min={0} />
            </label>
            <label className="space-y-1">
              <span className="label">Printing setup</span>
              <input className="input" name="setupCost" type="number" step="0.01" min={0} />
            </label>
            <label className="space-y-1">
              <span className="label">Mould cost</span>
              <input className="input" name="mouldCost" type="number" step="0.01" min={0} />
            </label>
            <label className="space-y-1">
              <span className="label">Domestic shipping</span>
              <input className="input" name="domesticShipping" type="number" step="0.01" min={0} />
            </label>
            <label className="space-y-1">
              <span className="label">International freight</span>
              <input className="input" name="intlShipping" type="number" step="0.01" min={0} />
            </label>
            <label className="space-y-1">
              <span className="label">Customs %</span>
              <input className="input" name="customsPct" type="number" step="0.1" min={0} max={100} />
            </label>
            <label className="space-y-1">
              <span className="label">Extra fees (insurance, agent…)</span>
              <input className="input" name="extraFees" type="number" step="0.01" min={0} />
            </label>
            <label className="space-y-1">
              <span className="label">Contingency %</span>
              <input className="input" name="contingencyPct" type="number" step="0.5" min={0} max={100} defaultValue="3" />
            </label>
            <label className="space-y-1">
              <span className="label">Product URL</span>
              <input className="input" name="productUrl" maxLength={2048} placeholder="https://…" />
            </label>
            <label className="space-y-1">
              <span className="label">Label</span>
              <input className="input" name="title" maxLength={300} placeholder="350gsm kraft, 2-colour" />
            </label>
            <label className="space-y-1 sm:col-span-2 lg:col-span-4">
              <span className="label">Notes</span>
              <textarea className="textarea" name="notes" maxLength={2000} />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="btn btn-primary" type="submit">
                Add quote · landed cost is calculated automatically
              </button>
            </div>
          </form>
        )}
      </details>

      {request.notes && (
        <section className="panel p-4">
          <h2 className="label text-[var(--accent)] mb-2">Notes</h2>
          <p className="text-sm text-[var(--text-dim)] whitespace-pre-wrap">{request.notes}</p>
        </section>
      )}
    </div>
  );
}
