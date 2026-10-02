import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verstuurd",
  CONFIRMED: "Bevestigd",
  SHIPPED: "Onderweg",
  RECEIVED: "Ontvangen",
  CANCELLED: "Geannuleerd",
};

export default async function SupplierOrdersPage() {
  await requirePageUser(["admin", "sales"]);

  const orders = await prisma.supplierOrder
    .findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        expectedAt: true,
        updatedAt: true,
        supplier: { select: { name: true } },
      },
    })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-2xl space-y-6 anim-lock">
      <div>
        <Link href="/sourcing" className="label text-[var(--accent)]">
          ← Inkoop
        </Link>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Bestellingen
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Kaigo- en packaging-orders: van concept tot ontvangen.
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-[var(--text-dim)] text-center">
          Nog geen bestellingen. Kies een offerte bij een aanvraag en maak er
          een order van.
        </p>
      ) : (
        <ul className="ios-list">
          {orders.map((order) => (
            <li
              key={order.id}
              className="border-b border-[var(--line)] last:border-0"
            >
              <Link
                href={`/sourcing/orders/${order.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block font-semibold truncate">
                    {order.title}
                  </span>
                  <span className="block text-sm text-[var(--text-dim)] truncate">
                    {order.code}
                    {" · "}
                    {order.supplier.name}
                    {order.expectedAt
                      ? ` · verwacht ${order.expectedAt.toLocaleDateString("nl-BE")}`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[var(--text-dim)]">
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
