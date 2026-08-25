import Link from "next/link";
import { requirePageUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { SHOP_DIKSMUIDE } from "@/lib/constants";
import { ShopTenantForm } from "@/components/ShopTenantForm";
import { ShopWaitlistForm } from "@/components/ShopWaitlistForm";

export const dynamic = "force-dynamic";

export default async function ShopNieuwPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; leadId?: string }>;
}) {
  await requirePageUser(["admin", "sales"]);
  const { slot: slotParam, leadId } = await searchParams;
  const preferred = slotParam ? Number(slotParam) : null;

  const [products, settings, taken, lead] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, line: "MACHINE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, line: true },
    }),
    prisma.appSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
      select: { shopCapacity: true },
    }),
    prisma.machinePlacement.findMany({
      where: {
        site: SHOP_DIKSMUIDE.site,
        status: "ACTIVE",
        shopSlot: { not: null },
      },
      select: { shopSlot: true },
    }),
    leadId
      ? prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            notes: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const capacity = Math.max(1, Math.min(40, settings.shopCapacity || 8));
  const occupied = new Set(
    taken.map((t) => t.shopSlot).filter((n): n is number => n != null)
  );
  const freeSlots = Array.from({ length: capacity }, (_, i) => i + 1).filter(
    (n) => !occupied.has(n)
  );

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <Link href="/shop" className="label text-[var(--accent)]">
          ← Shop
        </Link>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Nieuwe shop-huurder
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Partner op een vaste plek in {SHOP_DIKSMUIDE.label} (
          {freeSlots.length} vrij van {capacity}).
        </p>
      </div>
      {freeSlots.length ? (
        <section className="panel p-5">
          <ShopTenantForm
            products={products}
            freeSlots={freeSlots}
            defaultSlot={
              preferred && Number.isInteger(preferred) ? preferred : null
            }
            prefill={
              lead
                ? {
                    leadId: lead.id,
                    name: lead.name,
                    phone: lead.phone,
                    email: lead.email,
                    notes: lead.notes,
                  }
                : null
            }
          />
        </section>
      ) : (
        <ShopWaitlistForm
          prefill={
            lead
              ? {
                  leadId: lead.id,
                  name: lead.name,
                  phone: lead.phone,
                  email: lead.email,
                  notes: lead.notes,
                }
              : null
          }
        />
      )}
    </div>
  );
}
