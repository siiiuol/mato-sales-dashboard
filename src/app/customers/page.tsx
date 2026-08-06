import { prisma } from "@/lib/db";
import { convertLeadToCustomer } from "@/lib/actions";
import { formatEUR, PRODUCT_LINES } from "@/lib/constants";
import { ConvertButton } from "@/components/ConvertButton";
import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const [customers, convertible] = await Promise.all([
    prisma.customer.findMany({
      include: {
        purchases: { include: { product: true } },
        deals: true,
        lead: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        status: { in: ["NEGOTIATION", "CONTACTED", "FOLLOW_UP"] },
        customer: null,
      },
      orderBy: { score: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Channel 05</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Customers</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Purchased base for upsell · terminals, telemetry, packaging
        </p>
      </div>

      {convertible.length > 0 && (
        <section className="panel p-4">
          <h2 className="label text-[var(--accent)] mb-3">Convert lead → customer</h2>
          <ul className="space-y-2">
            {convertible.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2"
              >
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-[var(--text-dim)]">
                    {l.city} · score {l.score}
                  </div>
                </div>
                <ConvertButton leadId={l.id} action={convertLeadToCustomer} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {customers.length === 0 && (
          <section className="panel p-6 text-[var(--text-dim)] md:col-span-2">
            No customers yet. Win a deal or convert a lead.
          </section>
        )}
        {customers.map((c) => {
          const spend = c.purchases.reduce((s, p) => s + p.qty * p.unitPrice, 0);
          const lines = new Set(c.purchases.map((purchase) => purchase.product.line));
          const expansion = [
            lines.has("MACHINE") && !lines.has("TERMINAL") ? "Add cashless terminal" : null,
            lines.has("MACHINE") && !lines.has("TELEMETRY") ? "Add telemetry plan" : null,
            lines.has("MACHINE") && !lines.has("BEHUIZING") ? "Assess outdoor housing" : null,
          ].filter(Boolean);
          return (
            <article key={c.id} className="panel p-4 space-y-3">
              <div className="flex justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-lg">{c.name}</h2>
                  <p className="text-sm text-[var(--text-dim)]">
                    {[c.address, c.city, c.province].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="label">Spend</div>
                  <div className="score">{formatEUR(spend)}</div>
                </div>
              </div>
              <div className="text-sm">
                <span className="label">Contact</span>
                <div className="mt-1">{c.phone ?? "—"} · {c.email ?? "no email"}</div>
              </div>
              <div>
                <div className="label mb-2">Installed / purchased</div>
                {c.purchases.length === 0 ? (
                  <p className="text-sm text-[var(--text-dim)]">No purchases logged</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {c.purchases.map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span>
                          {p.qty}× {p.product.name}{" "}
                          <span className="badge ml-1">
                            {PRODUCT_LINES.find((x) => x.value === p.product.line)?.label}
                          </span>
                        </span>
                        <span className="mono">{formatEUR(p.qty * p.unitPrice)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="text-xs text-[var(--text-dim)]">
                Open deals: {c.deals.filter((d) => d.stage !== "WON" && d.stage !== "LOST").length}
              </div>
              <div>
                <div className="label mb-1">Expansion signals</div>
                <p className="text-sm text-[var(--accent)]">
                  {expansion.length ? expansion.join(" · ") : "Installed stack covered"}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
