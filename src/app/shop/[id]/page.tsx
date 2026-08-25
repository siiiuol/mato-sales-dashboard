import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { idSchema } from "@/lib/validation";
import {
  SHOP_CONTRACT_TYPES,
  SHOP_DIKSMUIDE,
  machineStatusLabel,
  shopContractTypeLabel,
} from "@/lib/constants";
import { markMachineRemoved } from "@/lib/machine-actions";
import { updateShopPlacement } from "@/lib/shop-actions";
import { TenantDocumentForm } from "@/components/TenantDocumentForm";

export const dynamic = "force-dynamic";

export default async function ShopTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const tenant = await prisma.customer.findFirst({
    where: { id: parsed.data, kind: "SHOP_TENANT" },
    include: {
      machinePlacements: {
        where: { site: "SHOP_DIKSMUIDE" },
        orderBy: { placedAt: "desc" },
        include: { product: { select: { name: true } } },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          templateCode: true,
          createdAt: true,
        },
      },
    },
  });
  if (!tenant) notFound();
  const partnerTemplates = await prisma.documentTemplate.findMany({
    where: {
      status: "MATO_APPROVED",
      code: { startsWith: "PARTNER_" },
    },
    orderBy: { name: "asc" },
    select: { code: true, name: true },
  });

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link href="/shop" className="label text-[var(--accent)]">
            ← Huurders
          </Link>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            {tenant.name}
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {SHOP_DIKSMUIDE.address}, {SHOP_DIKSMUIDE.city}
          </p>
          <p className="text-sm mt-2">
            {tenant.phone ?? "—"} · {tenant.email ?? "—"}
          </p>
        </div>
      </div>

      {tenant.notes && (
        <section className="panel p-4 text-sm">{tenant.notes}</section>
      )}

      <section className="space-y-3">
        <h2 className="label text-[var(--accent)]">Automaten & contract</h2>
        {tenant.machinePlacements.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Nog geen plaatsing.</p>
        ) : (
          tenant.machinePlacements.map((p) => (
            <article key={p.id} className="panel p-4 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {p.product?.name ?? p.model ?? "Automaat"}
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {p.serialNumber ? `SN ${p.serialNumber} · ` : ""}
                    {machineStatusLabel(p.status)} ·{" "}
                    {shopContractTypeLabel(p.contractType)}
                  </p>
                </div>
                {p.status === "ACTIVE" && (
                  <form action={markMachineRemoved}>
                    <input type="hidden" name="placementId" value={p.id} />
                    <input type="hidden" name="customerId" value={tenant.id} />
                    <button type="submit" className="btn text-sm">
                      Weghalen
                    </button>
                  </form>
                )}
              </div>

              {p.status === "ACTIVE" && (
                <form action={updateShopPlacement} className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="placementId" value={p.id} />
                  <input type="hidden" name="customerId" value={tenant.id} />
                  <select
                    name="contractType"
                    className="select"
                    defaultValue={p.contractType ?? "FIXED"}
                  >
                    {SHOP_CONTRACT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="contractRef"
                    className="input"
                    placeholder="Contractref."
                    defaultValue={p.contractRef ?? ""}
                  />
                  <input
                    name="contractStartedAt"
                    type="date"
                    className="input"
                    defaultValue={
                      (p.contractStartedAt ?? p.placedAt).toISOString().slice(0, 10)
                    }
                  />
                  <input
                    name="contractEndsAt"
                    type="date"
                    className="input"
                    aria-label="Einddatum contract"
                    defaultValue={p.contractEndsAt?.toISOString().slice(0, 10) ?? ""}
                  />
                  <input
                    name="noticePeriodDays"
                    type="number"
                    min={0}
                    max={365}
                    className="input"
                    aria-label="Opzegtermijn in dagen"
                    defaultValue={p.noticePeriodDays}
                  />
                  <select
                    name="renewalStatus"
                    className="select"
                    defaultValue={p.renewalStatus}
                  >
                    <option value="ACTIVE">Actief</option>
                    <option value="NOTICE_SENT">Opzeg/verlenging verstuurd</option>
                    <option value="RENEWING">Wordt verlengd</option>
                    <option value="ENDING">Eindigt</option>
                  </select>
                  <input
                    name="model"
                    className="input"
                    placeholder="Model"
                    defaultValue={p.model ?? ""}
                  />
                  <input
                    name="serialNumber"
                    className="input"
                    placeholder="Serienummer"
                    defaultValue={p.serialNumber ?? ""}
                  />
                  <label className="block space-y-1">
                    <span className="text-sm text-[var(--text-dim)]">Plaatsnummer</span>
                    <input
                      name="shopSlot"
                      type="number"
                      min={1}
                      max={40}
                      className="input"
                      placeholder="bv. 3"
                      defaultValue={p.shopSlot ?? ""}
                    />
                  </label>
                  <input
                    name="notes"
                    className="input"
                    placeholder="Notitie"
                    defaultValue={p.notes ?? ""}
                  />
                  <button type="submit" className="btn btn-primary sm:col-span-2">
                    Contract / plaats bijwerken
                  </button>
                </form>
              )}
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="label text-[var(--accent)]">Documenten</h2>
        <TenantDocumentForm
          customerId={tenant.id}
          placements={tenant.machinePlacements.map((placement) => ({
            id: placement.id,
            label: `Plaats ${placement.shopSlot ?? "—"} · ${
              placement.product?.name ?? placement.model ?? "Automaat"
            }`,
          }))}
          templates={partnerTemplates}
        />
        {tenant.documents.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Nog geen documenten voor deze huurder.
          </p>
        ) : (
          <ul className="panel divide-y divide-[var(--border)]">
            {tenant.documents.map((d) => (
              <li key={d.id} className="p-3 flex justify-between gap-2 text-sm">
                <Link href={`/documenten/${d.id}`} className="hover:text-[var(--accent)]">
                  <span className="mono text-xs">{d.number}</span>
                  <span className="block">{d.title}</span>
                </Link>
                <span className="text-xs text-[var(--text-dim)]">
                  {d.createdAt.toLocaleDateString("nl-BE")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
