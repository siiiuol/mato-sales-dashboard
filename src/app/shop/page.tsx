import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import {
  SHOP_DIKSMUIDE,
  machineStatusLabel,
  shopContractTypeLabel,
} from "@/lib/constants";
import {
  setShopCapacity,
  updateShopWaitlistStatus,
} from "@/lib/shop-actions";

export const dynamic = "force-dynamic";

type SlotPlacement = {
  id: string;
  shopSlot: number | null;
  model: string | null;
  serialNumber: string | null;
  status: string;
  contractType: string | null;
  contractRef: string | null;
  contractStartedAt: Date | null;
  contractEndsAt: Date | null;
  renewalStatus: string;
  placedAt: Date;
  product: { name: string } | null;
  customer: { id: string; name: string; phone: string | null; email: string | null };
};

/**
 * Shop = showroom/vastgoed met beperkt aantal plaatsen + huurdersadministratie.
 */
export default async function ShopPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);

  const [settings, placements, tenants, waitlist] = await Promise.all([
    prisma.appSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
      select: { shopCapacity: true },
    }),
    prisma.machinePlacement.findMany({
      where: { site: SHOP_DIKSMUIDE.site, status: "ACTIVE" },
      orderBy: [{ shopSlot: "asc" }, { placedAt: "asc" }],
      select: {
        id: true,
        shopSlot: true,
        model: true,
        serialNumber: true,
        status: true,
        contractType: true,
        contractRef: true,
        contractStartedAt: true,
        contractEndsAt: true,
        renewalStatus: true,
        placedAt: true,
        product: { select: { name: true } },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    }),
    prisma.customer.findMany({
      where: { kind: "SHOP_TENANT" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        machinePlacements: {
          where: { site: SHOP_DIKSMUIDE.site },
          orderBy: { placedAt: "desc" },
          select: {
            id: true,
            model: true,
            serialNumber: true,
            status: true,
            contractType: true,
            contractRef: true,
            contractStartedAt: true,
            contractEndsAt: true,
            renewalStatus: true,
            placedAt: true,
            shopSlot: true,
            product: { select: { name: true } },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { id: true, number: true, title: true },
        },
      },
    }),
    prisma.shopWaitlist.findMany({
      where: { status: { in: ["WAITING", "CONTACTED"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        notes: true,
        status: true,
        leadId: true,
        createdAt: true,
      },
    }),
  ]);

  const capacity = Math.max(1, Math.min(40, settings.shopCapacity || 8));
  const bySlot = new Map<number, SlotPlacement>();
  const unassigned: SlotPlacement[] = [];
  for (const p of placements) {
    if (p.shopSlot != null && p.shopSlot >= 1 && p.shopSlot <= capacity) {
      bySlot.set(p.shopSlot, p);
    } else {
      unassigned.push(p);
    }
  }
  const freeCount = capacity - bySlot.size;
  const occupiedCount = bySlot.size + unassigned.length;
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const expiring30 = placements.filter(
    (placement) =>
      placement.contractEndsAt && placement.contractEndsAt <= in30
  );
  const expiring60 = placements.filter(
    (placement) =>
      placement.contractEndsAt &&
      placement.contractEndsAt > in30 &&
      placement.contractEndsAt <= in60
  );

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="label">Shop · showroom & vastgoed</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            {SHOP_DIKSMUIDE.label}
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            {SHOP_DIKSMUIDE.address}, {SHOP_DIKSMUIDE.postalCode} {SHOP_DIKSMUIDE.city} ·
            beperkte plaatsen, huurders bijhouden.
          </p>
        </div>
        <Link href="/shop/nieuw" className="btn btn-primary shrink-0">
          Nieuwe huurder
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Plaatsen" value={`${occupiedCount} / ${capacity}`} />
        <Figure label="Vrij" value={String(Math.max(0, freeCount))} />
        <Figure label="Huurders" value={String(tenants.length)} />
        <Figure
          label="Contract binnen 60d"
          value={String(expiring30.length + expiring60.length)}
        />
      </section>

      {expiring30.length || expiring60.length ? (
        <section className="panel p-4 space-y-3">
          <h2 className="label text-[var(--caution)]">
            Aankomende contractmomenten
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...expiring30, ...expiring60].map((placement) => (
              <Link
                key={placement.id}
                href={`/shop/${placement.customer.id}`}
                className="rounded-lg border border-[var(--border)] p-3 hover:border-[var(--accent)]"
              >
                <span className="font-medium">{placement.customer.name}</span>
                <span className="block text-xs text-[var(--text-dim)] mt-1">
                  Plaats {placement.shopSlot ?? "—"} · einde{" "}
                  {placement.contractEndsAt?.toLocaleDateString("nl-BE")} ·{" "}
                  {placement.renewalStatus}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="label text-[var(--accent)]">Plaatskaart</h2>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              Elke tegel is een fysieke plek in de shop. Klik een bezette plaats
              voor de huurderfiche.
            </p>
          </div>
          {user.role === "admin" ? (
            <form action={setShopCapacity} className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-dim)]" htmlFor="shopCapacity">
                Capaciteit
              </label>
              <input
                id="shopCapacity"
                name="shopCapacity"
                type="number"
                min={1}
                max={40}
                className="input w-20"
                defaultValue={capacity}
              />
              <button type="submit" className="btn btn-sm">
                Opslaan
              </button>
            </form>
          ) : null}
        </div>

        <div className="shop-slot-grid">
          {Array.from({ length: capacity }, (_, i) => i + 1).map((n) => {
            const p = bySlot.get(n);
            if (!p) {
              return (
                <Link
                  key={n}
                  href={`/shop/nieuw?slot=${n}`}
                  className="shop-slot"
                  data-state="free"
                >
                  <span className="shop-slot-num">Plaats {n}</span>
                  <span className="font-medium">Vrij</span>
                  <span className="text-xs">Huurder toevoegen →</span>
                </Link>
              );
            }
            return (
              <Link
                key={n}
                href={`/shop/${p.customer.id}`}
                className="shop-slot"
                data-state="taken"
              >
                <span className="shop-slot-num">Plaats {n}</span>
                <span className="font-medium leading-snug">{p.customer.name}</span>
                <span className="text-xs text-[var(--text-dim)]">
                  {p.product?.name ?? p.model ?? "Automaat"}
                </span>
                <span className="text-xs text-[var(--text-dim)]">
                  {shopContractTypeLabel(p.contractType)}
                </span>
              </Link>
            );
          })}
        </div>

        {unassigned.length > 0 ? (
          <div className="panel p-4 space-y-2">
            <p className="label text-[var(--caution)]">Zonder plaatsnummer</p>
            <p className="text-xs text-[var(--text-dim)]">
              Actieve automaten zonder toegewezen plek — zet een plaats op de
              huurderfiche.
            </p>
            <ul className="text-sm space-y-1">
              {unassigned.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/shop/${p.customer.id}`}
                    className="hover:text-[var(--accent)]"
                  >
                    {p.customer.name}
                  </Link>
                  <span className="text-[var(--text-dim)]">
                    {" "}
                    · {p.product?.name ?? p.model ?? "Automaat"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {tenants.length === 0 ? (
        <section className="panel p-6 space-y-3">
          <div className="label text-[var(--accent)]">Nog geen huurders</div>
          <p className="text-sm text-[var(--text-dim)] max-w-prose">
            De shop is showroom en vastgoed: voeg partners toe die een plek
            huren, met contractformule en plaatsnummer.
          </p>
          <Link href="/shop/nieuw" className="btn btn-primary inline-flex">
            Eerste huurder toevoegen
          </Link>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="label text-[var(--accent)]">Alle huurders</h2>
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Huurder</th>
                  <th>Plaats</th>
                  <th>Automaat</th>
                  <th>Contract</th>
                  <th>Referentie</th>
                  <th>Sinds</th>
                  <th>Einde</th>
                  <th>Status</th>
                  <th>Documenten</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const active = t.machinePlacements.filter((p) => p.status === "ACTIVE");
                  const rows = active.length ? active : t.machinePlacements.slice(0, 1);
                  if (!rows.length) {
                    return (
                      <tr key={t.id}>
                        <td>
                          <Link
                            href={`/shop/${t.id}`}
                            className="font-medium hover:text-[var(--accent)]"
                          >
                            {t.name}
                          </Link>
                        </td>
                        <td colSpan={7} className="text-[var(--text-dim)]">
                          Geen plaatsing
                        </td>
                        <td>
                          <DocLinks docs={t.documents} />
                        </td>
                      </tr>
                    );
                  }
                  return rows.map((p, i) => (
                    <tr key={`${t.id}-${p.id}`}>
                      <td>
                        {i === 0 ? (
                          <div>
                            <Link
                              href={`/shop/${t.id}`}
                              className="font-medium hover:text-[var(--accent)]"
                            >
                              {t.name}
                            </Link>
                            <p className="text-xs text-[var(--text-dim)]">
                              {t.phone ?? t.email ?? "—"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[var(--text-mute)]">↳</span>
                        )}
                      </td>
                      <td className="mono">{p.shopSlot ?? "—"}</td>
                      <td>
                        {p.product?.name ?? p.model ?? "—"}
                        {p.serialNumber ? (
                          <span className="block text-xs mono text-[var(--text-dim)]">
                            {p.serialNumber}
                          </span>
                        ) : null}
                      </td>
                      <td>{shopContractTypeLabel(p.contractType)}</td>
                      <td className="mono text-xs">{p.contractRef ?? "—"}</td>
                      <td>
                        {(p.contractStartedAt ?? p.placedAt).toLocaleDateString("nl-BE")}
                      </td>
                      <td>
                        {p.contractEndsAt?.toLocaleDateString("nl-BE") ?? "—"}
                      </td>
                      <td>
                        <span className="badge">{machineStatusLabel(p.status)}</span>
                      </td>
                      <td>{i === 0 ? <DocLinks docs={t.documents} /> : null}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="label text-[var(--accent)]">Wachtlijst</h2>
          <span className="badge">{waitlist.length}</span>
        </div>
        {waitlist.length ? (
          <ul className="panel divide-y divide-[var(--border)]">
            {waitlist.map((entry) => (
              <li
                key={entry.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="font-medium">{entry.name}</span>
                  <span className="block text-xs text-[var(--text-dim)]">
                    {[entry.phone, entry.email, entry.status]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {entry.notes ? (
                    <span className="block text-sm text-[var(--text-dim)] mt-1">
                      {entry.notes}
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {entry.leadId && freeCount > 0 ? (
                    <Link
                      href={`/shop/nieuw?leadId=${entry.leadId}`}
                      className="btn btn-sm btn-primary"
                    >
                      Plaatsen
                    </Link>
                  ) : null}
                  <form action={updateShopWaitlistStatus}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <button type="submit" className="btn btn-sm btn-ghost">
                      Verwijderen
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-dim)]">
            Niemand wacht momenteel op een plaats.
          </p>
        )}
      </section>

      <p className="text-sm text-[var(--text-dim)]">
        Contract-PDF’s:{" "}
        <Link href="/reclame/materiaal" className="text-[var(--accent)] underline">
          Reclame → Materiaal
        </Link>
        . Zoeken: ⌘K / Ctrl+K.
      </p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="label text-[var(--accent)]">{label}</p>
      <p className="display text-2xl mt-1">{value}</p>
    </div>
  );
}

function DocLinks({
  docs,
}: {
  docs: Array<{ id: string; number: string; title: string }>;
}) {
  if (!docs.length) return <span className="text-[var(--text-dim)]">—</span>;
  return (
    <ul className="text-xs space-y-1">
      {docs.map((d) => (
        <li key={d.id}>
          <Link href={`/documenten/${d.id}`} className="hover:text-[var(--accent)]">
            <span className="mono">{d.number}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
