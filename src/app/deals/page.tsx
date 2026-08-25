import Link from "next/link";
import { formatEUR } from "@/lib/constants";
import { requirePageUser } from "@/lib/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const deals = await prisma.deal.findMany({
    where: {
      stage: { in: ["QUALIFIED", "PROPOSAL", "NEGOTIATION"] },
      ...(user.role === "admin" ? {} : { ownerId: user.id }),
    },
    orderBy: [
      { expectedCloseAt: "asc" },
      { probability: "desc" },
      { updatedAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      stage: true,
      expectedValue: true,
      probability: true,
      expectedCloseAt: true,
      nextStep: true,
      expectedMachineCount: true,
      owner: { select: { name: true } },
      lead: { select: { id: true, name: true, city: true } },
      customer: { select: { id: true, name: true } },
      lines: {
        select: { qty: true, product: { select: { name: true } } },
      },
    },
  });
  const weightedValue = deals.reduce(
    (sum, deal) => sum + deal.expectedValue * (deal.probability / 100),
    0
  );

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Pipeline</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Open deals</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {deals.length} kansen · gewogen waarde {formatEUR(weightedValue)}
          </p>
        </div>
        <Link href="/leads" className="btn btn-primary">
          Nieuwe kans vanuit lead
        </Link>
      </div>

      {deals.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {deals.map((deal) => {
            const href = deal.lead
              ? `/leads/${deal.lead.id}#deal`
              : deal.customer
                ? `/klanten/${deal.customer.id}`
                : "/";
            return (
              <Link
                key={deal.id}
                href={href}
                className="panel p-4 hover:border-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="badge badge-live">{deal.stage}</span>
                    <h2 className="font-semibold mt-2">{deal.title}</h2>
                    <p className="text-sm text-[var(--text-dim)]">
                      {deal.lead?.name ?? deal.customer?.name ?? "Geen relatie"}
                      {deal.lead?.city ? ` · ${deal.lead.city}` : ""}
                    </p>
                  </div>
                  <span className="mono font-semibold">
                    {formatEUR(deal.expectedValue)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <span>Kans: {deal.probability}%</span>
                  <span>
                    Sluiten:{" "}
                    {deal.expectedCloseAt?.toLocaleDateString("nl-BE") ?? "—"}
                  </span>
                  <span>
                    Product:{" "}
                    {deal.lines
                      .map((line) => `${line.qty}× ${line.product.name}`)
                      .join(", ") || "te bepalen"}
                  </span>
                  <span>Eigenaar: {deal.owner?.name ?? "—"}</span>
                </div>
                <p className="text-sm mt-3">
                  <span className="label">Volgende stap</span>
                  <span className="block mt-1 text-[var(--text-dim)]">
                    {deal.nextStep ?? "Nog niet ingevuld"}
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <section className="panel p-8 text-center text-[var(--text-dim)]">
          Geen open deals. Maak er één op een leadfiche zodra er een concrete
          verkoopkans is.
        </section>
      )}
    </div>
  );
}
