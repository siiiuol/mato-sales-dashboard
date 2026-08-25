import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import {
  createContentItem,
  updateContentItemStatus,
} from "@/lib/content-calendar-actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  READY: "Klaar voor nazicht",
  APPROVED: "Goedgekeurd",
  PUBLISHED: "Gepubliceerd",
};

export default async function ContentCalendarPage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const [items, customers, placements] = await Promise.all([
    prisma.contentItem.findMany({
      orderBy: [{ plannedAt: "asc" }, { createdAt: "desc" }],
      include: {
        customer: { select: { name: true } },
        machinePlacement: {
          select: {
            serialNumber: true,
            model: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    prisma.machinePlacement.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        serialNumber: true,
        model: true,
        customer: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <Link href="/reclame" className="label text-[var(--accent)]">
          ← Reclame
        </Link>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Contentkalender
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Alleen echte klanten, installaties, automaten en FAQ’s. Publicatie
          blijft een menselijke beslissing.
        </p>
      </div>

      {user.role !== "reviewer" ? (
        <form
          action={createContentItem}
          className="panel p-4 grid gap-3 sm:grid-cols-2"
        >
          <input
            name="title"
            className="input sm:col-span-2"
            placeholder="Onderwerp of werktitel"
            required
            maxLength={200}
          />
          <select name="theme" className="select">
            <option value="CUSTOMER">Klantverhaal</option>
            <option value="INSTALLATION">Installatie</option>
            <option value="MACHINE">Automaat</option>
            <option value="FAQ">FAQ</option>
          </select>
          <select name="channel" className="select">
            <option value="LINKEDIN">LinkedIn</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="MAIL">Mail</option>
            <option value="WEBSITE">Website</option>
          </select>
          <input name="plannedAt" type="date" className="input" />
          <select name="customerId" className="select">
            <option value="">Geen klant gekoppeld</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} · {customer.kind}
              </option>
            ))}
          </select>
          <select name="machinePlacementId" className="select sm:col-span-2">
            <option value="">Geen installatie gekoppeld</option>
            {placements.map((placement) => (
              <option key={placement.id} value={placement.id}>
                {placement.customer.name} ·{" "}
                {placement.product?.name ?? placement.model ?? "Automaat"} ·{" "}
                {placement.serialNumber ?? "zonder serienummer"}
              </option>
            ))}
          </select>
          <textarea
            name="notes"
            className="textarea sm:col-span-2"
            rows={3}
            maxLength={5000}
            placeholder="Feiten, invalshoek en gewenste CTA"
          />
          <button type="submit" className="btn btn-primary sm:col-span-2">
            Als concept plannen
          </button>
        </form>
      ) : null}

      {items.length ? (
        <section className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="panel p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge">{STATUS_LABELS[item.status] ?? item.status}</span>
                  <span className="badge">{item.channel}</span>
                  <span className="badge">{item.theme}</span>
                </div>
                <h2 className="font-medium mt-2">{item.title}</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  {item.plannedAt?.toLocaleDateString("nl-BE") ?? "Nog niet gepland"}
                  {item.customer ? ` · ${item.customer.name}` : ""}
                  {item.machinePlacement
                    ? ` · ${
                        item.machinePlacement.product?.name ??
                        item.machinePlacement.model ??
                        "Automaat"
                      }`
                    : ""}
                </p>
                {item.notes ? (
                  <p className="text-sm text-[var(--text-dim)] mt-2 whitespace-pre-wrap">
                    {item.notes}
                  </p>
                ) : null}
              </div>
              {user.role !== "reviewer" ? (
                <form action={updateContentItemStatus} className="flex gap-2">
                  <input type="hidden" name="itemId" value={item.id} />
                  <select
                    name="status"
                    className="select"
                    defaultValue={item.status}
                  >
                    <option value="DRAFT">Concept</option>
                    <option value="READY">Klaar voor nazicht</option>
                    {user.role === "admin" ? (
                      <>
                        <option value="APPROVED">Goedgekeurd</option>
                        <option value="PUBLISHED">Gepubliceerd</option>
                      </>
                    ) : null}
                  </select>
                  <button type="submit" className="btn btn-sm">
                    Bijwerken
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <p className="panel p-6 text-sm text-[var(--text-dim)]">
          Nog geen content gepland.
        </p>
      )}
    </div>
  );
}
