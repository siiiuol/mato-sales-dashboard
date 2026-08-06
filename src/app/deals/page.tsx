import { prisma } from "@/lib/db";
import { addDealLine, createDeal, createQuote, updateDealCommercials } from "@/lib/actions";
import { DEAL_STAGES, dealTotal, formatEUR, PRODUCT_LINES } from "@/lib/constants";
import { StageButtons } from "@/components/StageButtons";
import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const [deals, products, leads, customers] = await Promise.all([
    prisma.deal.findMany({
      include: { lines: { include: { product: true } }, lead: true, customer: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.lead.findMany({
      where: { status: { notIn: ["LOST", "DO_NOT_CONTACT", "WON"] } },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Channel 04</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Deals</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Commercial pipeline · recurring value · margin · quotes
        </p>
      </div>

      <section className="panel p-4">
        <h2 className="label text-[var(--accent)] mb-3">New deal</h2>
        <form action={createDeal} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input name="title" className="input lg:col-span-2" placeholder="Deal title" required />
          <select name="leadId" className="select" defaultValue="">
            <option value="">Lead (optional)</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select name="customerId" className="select" defaultValue="">
            <option value="">Customer (optional)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="productId" className="select" required defaultValue="">
            <option value="" disabled>
              Product
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatEUR(p.listPrice)}
              </option>
            ))}
          </select>
          <input name="qty" type="number" min={1} defaultValue={1} className="input" />
          <input name="expectedMachineCount" type="number" min={0} defaultValue={1} className="input" placeholder="Machines" />
          <input name="recurringValue" type="number" min={0} step="0.01" defaultValue={0} className="input" placeholder="Recurring €/mo" />
          <input name="probability" type="number" min={0} max={100} defaultValue={25} className="input" placeholder="Probability %" />
          <input name="nextStep" className="input lg:col-span-2" placeholder="Next step" />
          <button type="submit" className="btn btn-primary">
            Create deal
          </button>
        </form>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {DEAL_STAGES.filter((s) => s !== "LOST").map((stage) => {
          const column = deals.filter((d) => d.stage === stage);
          const value = column.reduce(
            (s, d) => s + dealTotal(d.lines, d.discountPercent),
            0
          );
          return (
            <section key={stage} className="panel p-3 space-y-3">
              <div className="flex justify-between items-baseline">
                <h2 className="label text-[var(--accent)]">{stage}</h2>
                <span className="score text-sm">{formatEUR(value)}</span>
              </div>
              {column.length === 0 && (
                <p className="text-sm text-[var(--text-dim)]">Empty</p>
              )}
              {column.map((deal) => (
                <article
                  key={deal.id}
                  className="border border-[var(--border)] p-3 space-y-2 bg-[rgba(0,0,0,0.2)]"
                >
                  <div className="font-medium">{deal.title}</div>
                  <div className="text-xs text-[var(--text-dim)]">
                    {deal.lead?.name ?? deal.customer?.name ?? "No account"}
                  </div>
                  <ul className="text-sm space-y-1">
                    {deal.lines.map((line) => (
                      <li key={line.id} className="flex justify-between gap-2">
                        <span>
                          {line.qty}× {line.product.name}
                        </span>
                        <span className="mono">
                          {formatEUR(line.qty * line.unitPrice)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="score text-sm">
                    Total {formatEUR(dealTotal(deal.lines, deal.discountPercent))}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-[var(--text-dim)]">
                    <span>{deal.expectedMachineCount} machines expected</span>
                    <span>{formatEUR(deal.recurringValue)}/mo recurring</span>
                    <span>{deal.probability}% probability</span>
                    <span>{deal.grossMargin == null ? "Margin —" : `${formatEUR(deal.grossMargin)} margin`}</span>
                  </div>
                  <div className="text-xs">{deal.nextStep || "No next step"}</div>
                  <StageButtons dealId={deal.id} stage={deal.stage} />
                  <details>
                    <summary className="label cursor-pointer">Commercial fields</summary>
                    <form action={updateDealCommercials} className="grid gap-2 mt-2">
                      <input type="hidden" name="dealId" value={deal.id} />
                      <input name="expectedMachineCount" type="number" min={0} defaultValue={deal.expectedMachineCount} className="input" />
                      <input name="recurringValue" type="number" min={0} step="0.01" defaultValue={deal.recurringValue} className="input" />
                      <input name="probability" type="number" min={0} max={100} defaultValue={deal.probability} className="input" />
                      <input name="grossMargin" type="number" min={0} step="0.01" defaultValue={deal.grossMargin ?? ""} className="input" placeholder="Gross margin €" />
                      <input name="expectedCloseAt" type="date" defaultValue={deal.expectedCloseAt?.toISOString().slice(0, 10)} className="input" />
                      <input name="nextStep" defaultValue={deal.nextStep ?? ""} className="input" placeholder="Next step" />
                      <input name="lossReason" defaultValue={deal.lossReason ?? ""} className="input" placeholder="Loss reason" />
                      <button className="btn btn-primary">Save</button>
                    </form>
                  </details>
                  <form action={addDealLine} className="flex gap-2">
                    <input type="hidden" name="dealId" value={deal.id} />
                    <select name="productId" className="select text-sm" required defaultValue="">
                      <option value="" disabled>
                        Add line
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {PRODUCT_LINES.find((x) => x.value === p.line)?.label} · {p.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn btn-ghost">
                      +
                    </button>
                  </form>
                  <form action={createQuote}>
                    <input type="hidden" name="dealId" value={deal.id} />
                    <button className="btn btn-ghost w-full">Create quote snapshot</button>
                  </form>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      {deals.some((d) => d.stage === "LOST") && (
        <section className="panel p-4">
          <h2 className="label mb-2">Lost</h2>
          <ul className="text-sm text-[var(--text-dim)] space-y-1">
            {deals
              .filter((d) => d.stage === "LOST")
              .map((d) => (
                <li key={d.id}>{d.title} · {d.lossReason || "loss reason missing"}</li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
