import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { advanceSupplierOrder } from "@/lib/supplier-order-actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verstuurd",
  CONFIRMED: "Bevestigd",
  SHIPPED: "Onderweg",
  RECEIVED: "Ontvangen",
  CANCELLED: "Geannuleerd",
};

const NEXT_LABEL: Record<string, string> = {
  DRAFT: "Markeer als verstuurd",
  SENT: "Leverancier bevestigde",
  CONFIRMED: "Markeer als onderweg",
  SHIPPED: "Markeer als ontvangen",
};

export default async function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales"]);
  const { id } = await params;

  const order = await prisma.supplierOrder
    .findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, email: true, country: true } },
        deal: { select: { id: true, title: true, leadId: true } },
        customer: { select: { id: true, name: true } },
        sourcingRequest: { select: { id: true, code: true, title: true } },
        createdBy: { select: { name: true } },
      },
    })
    .catch(() => null);

  if (!order) notFound();

  const nextLabel = NEXT_LABEL[order.status];

  return (
    <div className="mx-auto max-w-lg space-y-6 anim-lock">
      <div>
        <Link href="/sourcing/orders" className="label text-[var(--accent)]">
          ← Bestellingen
        </Link>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          {order.title}
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {order.code}
          {" · "}
          {STATUS_LABEL[order.status] ?? order.status}
          {order.createdBy?.name ? ` · ${order.createdBy.name}` : ""}
        </p>
      </div>

      <section className="panel p-4 space-y-2 text-sm">
        <p>
          <span className="text-[var(--text-dim)]">Leverancier · </span>
          {order.supplier.name}
          {order.supplier.country ? ` (${order.supplier.country})` : ""}
        </p>
        {order.customer ? (
          <p>
            <span className="text-[var(--text-dim)]">Klant · </span>
            <Link
              href={`/klanten/${order.customer.id}`}
              className="hover:text-[var(--accent)]"
            >
              {order.customer.name}
            </Link>
          </p>
        ) : null}
        {order.sourcingRequest ? (
          <p>
            <span className="text-[var(--text-dim)]">Aanvraag · </span>
            <Link
              href={`/sourcing/${order.sourcingRequest.id}`}
              className="hover:text-[var(--accent)]"
            >
              {order.sourcingRequest.code}
            </Link>
          </p>
        ) : null}
        {order.deal?.leadId ? (
          <p>
            <span className="text-[var(--text-dim)]">Zaak · </span>
            <Link
              href={`/leads/${order.deal.leadId}`}
              className="hover:text-[var(--accent)]"
            >
              {order.deal.title}
            </Link>
          </p>
        ) : null}
        {order.expectedAt ? (
          <p>
            <span className="text-[var(--text-dim)]">Verwacht · </span>
            {order.expectedAt.toLocaleDateString("nl-BE")}
          </p>
        ) : null}
        {order.notes ? (
          <p className="whitespace-pre-wrap pt-2 border-t border-[var(--line)]">
            {order.notes}
          </p>
        ) : null}
      </section>

      {nextLabel ? (
        <form action={advanceSupplierOrder}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="action" value="next" />
          <button type="submit" className="btn btn-primary w-full">
            {nextLabel}
          </button>
        </form>
      ) : null}

      {order.status !== "CANCELLED" && order.status !== "RECEIVED" ? (
        <form action={advanceSupplierOrder}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="action" value="cancel" />
          <button type="submit" className="btn w-full">
            Annuleren
          </button>
        </form>
      ) : null}
    </div>
  );
}
