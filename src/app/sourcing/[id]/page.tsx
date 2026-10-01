import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import {
  addSupplierQuote,
  createSupplier,
  selectSupplierQuote,
} from "@/lib/sourcing-actions";
import { createOrderFromSourcing } from "@/lib/supplier-order-actions";
import { euroCents, rankSupplierQuotes } from "@/lib/sourcing-economics";

export const dynamic = "force-dynamic";

export default async function SourcingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales"]);
  const { id } = await params;

  const [request, suppliers] = await Promise.all([
    prisma.sourcingRequest
      .findUnique({
        where: { id },
        include: {
          quotes: {
            include: { supplier: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
          requestedBy: { select: { name: true } },
        },
      })
      .catch(() => null),
    prisma.supplier
      .findMany({
        where: { status: { not: "ARCHIVED" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, currency: true },
        take: 200,
      })
      .catch(() => []),
  ]);

  if (!request) notFound();

  const ranked = rankSupplierQuotes(
    request.quotes.map((quote) => ({
      id: quote.id,
      supplierName: quote.supplier.name,
      currency: quote.currency,
      unitPrice: quote.unitPrice,
      fxToEur: quote.fxToEur,
      sampleCost: quote.sampleCost,
      setupCost: quote.setupCost,
      mouldCost: quote.mouldCost,
      domesticShipping: quote.domesticShipping,
      intlShipping: quote.intlShipping,
      customsPct: quote.customsPct,
      extraFees: quote.extraFees,
      contingencyPct: quote.contingencyPct,
      moq: quote.moq,
      productionDays: quote.productionDays,
      selected: quote.selected,
    })),
    {
      quantity: request.quantity || 1,
      requiredMarginPct: request.requiredMarginPct,
      targetSellPrice: request.targetSellPrice,
      maxMoq: request.maxMoq,
    }
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 anim-lock">
      <div>
        <Link href="/sourcing" className="label text-[var(--accent)]">
          ← Inkoop
        </Link>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          {request.title}
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {request.code}
          {" · "}
          {request.quantity.toLocaleString("nl-BE")} st
          {request.requiredMarginPct != null
            ? ` · marge ${request.requiredMarginPct}%`
            : ""}
          {request.requestedBy?.name
            ? ` · ${request.requestedBy.name}`
            : ""}
        </p>
        {request.description ? (
          <p className="text-sm mt-3 whitespace-pre-wrap">{request.description}</p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="label text-[var(--accent)]">Vergelijking</h2>
        {ranked.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Nog geen offertes. Voeg er hieronder een toe.
          </p>
        ) : (
          <ul className="ios-list">
            {ranked.map((row, index) => (
              <li
                key={row.id}
                className="border-b border-[var(--line)] last:border-0 px-4 py-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {index === 0 && row.passesMoq ? "Beste · " : ""}
                      {row.supplierName}
                      {row.selected ? " · gekozen" : ""}
                    </p>
                    <p className="text-sm text-[var(--text-dim)]">
                      Landed {euroCents(row.unitLandedEur)}/st
                      {" · "}
                      batch {euroCents(row.batchLandedEur)}
                      {!row.passesMoq ? " · MOQ te hoog" : ""}
                    </p>
                    {row.suggestedSellEur != null ? (
                      <p className="text-sm text-[var(--text-dim)]">
                        Adviesverkoop {euroCents(row.suggestedSellEur)}/st
                        {row.marginAtTarget != null
                          ? ` · bij doelprijs ${Math.round(row.marginAtTarget * 100)}% marge`
                          : ""}
                      </p>
                    ) : row.marginAtTarget != null ? (
                      <p className="text-sm text-[var(--text-dim)]">
                        Bij doelprijs {Math.round(row.marginAtTarget * 100)}%
                        marge
                      </p>
                    ) : null}
                    {row.moq != null || row.productionDays != null ? (
                      <p className="text-xs text-[var(--text-dim)]">
                        {row.moq != null
                          ? `MOQ ${row.moq.toLocaleString("nl-BE")}`
                          : ""}
                        {row.moq != null && row.productionDays != null
                          ? " · "
                          : ""}
                        {row.productionDays != null
                          ? `${row.productionDays} d productie`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  {!row.selected ? (
                    <form action={selectSupplierQuote}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="quoteId" value={row.id} />
                      <button type="submit" className="btn btn-sm">
                        Kies
                      </button>
                    </form>
                  ) : (
                    <span className="badge badge-live">Gekozen</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {ranked.some((row) => row.selected) ? (
          <form action={createOrderFromSourcing} className="pt-2">
            <input type="hidden" name="requestId" value={request.id} />
            <button type="submit" className="btn btn-primary w-full">
              Bestelling maken bij leverancier
            </button>
          </form>
        ) : null}
      </section>

      <details className="panel p-4" open={ranked.length === 0}>
        <summary className="font-medium cursor-pointer">Offerte toevoegen</summary>
        {suppliers.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)] mt-3">
            Eerst een leverancier aanmaken hieronder.
          </p>
        ) : (
          <form action={addSupplierQuote} className="space-y-2 mt-3">
            <input type="hidden" name="requestId" value={request.id} />
            <select name="supplierId" className="select" required defaultValue="">
              <option value="" disabled>
                Leverancier
              </option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="label">Prijs/st</span>
                <input
                  name="unitPrice"
                  type="number"
                  min={0}
                  step="0.0001"
                  className="input mt-1"
                  required
                />
              </label>
              <label className="block">
                <span className="label">Valuta</span>
                <input
                  name="currency"
                  className="input mt-1"
                  defaultValue="USD"
                  maxLength={8}
                />
              </label>
              <label className="block">
                <span className="label">Koers → €</span>
                <input
                  name="fxToEur"
                  type="number"
                  min={0.0001}
                  step="0.0001"
                  className="input mt-1"
                  defaultValue={0.92}
                  required
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Intl. shipping</span>
                <input
                  name="intlShipping"
                  type="number"
                  min={0}
                  step="0.01"
                  className="input mt-1"
                  defaultValue={0}
                />
              </label>
              <label className="block">
                <span className="label">Invoer %</span>
                <input
                  name="customsPct"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  className="input mt-1"
                  defaultValue={0}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Setup / mould</span>
                <input
                  name="setupCost"
                  type="number"
                  min={0}
                  step="0.01"
                  className="input mt-1"
                  defaultValue={0}
                />
              </label>
              <label className="block">
                <span className="label">Mould</span>
                <input
                  name="mouldCost"
                  type="number"
                  min={0}
                  step="0.01"
                  className="input mt-1"
                  defaultValue={0}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">MOQ</span>
                <input
                  name="moq"
                  type="number"
                  min={0}
                  className="input mt-1"
                />
              </label>
              <label className="block">
                <span className="label">Productiedagen</span>
                <input
                  name="productionDays"
                  type="number"
                  min={0}
                  className="input mt-1"
                />
              </label>
            </div>
            <input
              name="contingencyPct"
              type="hidden"
              value="3"
            />
            <button type="submit" className="btn btn-primary w-full">
              Offerte bewaren
            </button>
          </form>
        )}
      </details>

      <details className="panel p-4">
        <summary className="font-medium cursor-pointer">
          Leverancier toevoegen
        </summary>
        <form action={createSupplier} className="space-y-2 mt-3">
          <input type="hidden" name="returnTo" value={`/sourcing/${request.id}`} />
          <input
            name="name"
            className="input"
            required
            maxLength={200}
            placeholder="Naam fabriek / trading"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="country"
              className="input"
              defaultValue="China"
              maxLength={80}
              placeholder="Land"
            />
            <input
              name="currency"
              className="input"
              defaultValue="USD"
              maxLength={8}
              placeholder="Valuta"
            />
          </div>
          <button type="submit" className="btn w-full">
            Leverancier opslaan
          </button>
        </form>
      </details>
    </div>
  );
}
