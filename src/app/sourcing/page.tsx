import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { createSourcingRequest } from "@/lib/sourcing-actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Ingediend",
  QUOTED: "Offertes",
  SELECTED: "Gekozen",
  ORDERED: "Besteld",
  CLOSED: "Gesloten",
};

export default async function SourcingPage() {
  await requirePageUser(["admin", "sales"]);

  const requests = await prisma.sourcingRequest
    .findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        code: true,
        title: true,
        category: true,
        quantity: true,
        status: true,
        priority: true,
        requiredMarginPct: true,
        updatedAt: true,
        quotes: { select: { id: true, selected: true } },
      },
    })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-2xl space-y-6 anim-lock">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Inkoop</p>
          <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
            Packaging & sourcing
          </h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Offertes vergelijken op echte landed cost in euro — niet op de
            fabrieksprijs alleen.
          </p>
        </div>
        <Link href="/sourcing/orders" className="btn btn-sm shrink-0">
          Bestellingen
        </Link>
      </div>

      <details className="panel p-4" open={requests.length === 0}>
        <summary className="font-medium cursor-pointer">
          Nieuwe aanvraag
        </summary>
        <form action={createSourcingRequest} className="space-y-3 mt-3">
          <input
            name="title"
            className="input"
            required
            maxLength={200}
            placeholder="Bijv. Kraft zakjes 250 g — wit"
          />
          <div className="grid grid-cols-2 gap-2">
            <select name="category" className="select" defaultValue="PACKAGING">
              <option value="PACKAGING">Verpakking</option>
              <option value="MACHINE">Automaat / machine</option>
              <option value="PARTS">Onderdelen</option>
              <option value="OTHER">Overig</option>
            </select>
            <select name="priority" className="select" defaultValue="NORMAL">
              <option value="LOW">Lage prioriteit</option>
              <option value="NORMAL">Normaal</option>
              <option value="HIGH">Hoog</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Aantal</span>
              <input
                name="quantity"
                type="number"
                min={1}
                className="input mt-1"
                defaultValue={1000}
                required
              />
            </label>
            <label className="block">
              <span className="label">Gewenste marge %</span>
              <input
                name="requiredMarginPct"
                type="number"
                min={0}
                max={99}
                step="0.1"
                className="input mt-1"
                defaultValue={40}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Doel kostprijs €/st</span>
              <input
                name="targetUnitCost"
                type="number"
                min={0}
                step="0.01"
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="label">Doel verkoop €/st</span>
              <input
                name="targetSellPrice"
                type="number"
                min={0}
                step="0.01"
                className="input mt-1"
              />
            </label>
          </div>
          <textarea
            name="description"
            className="textarea"
            rows={3}
            placeholder="Afmetingen, materiaal, druk…"
            maxLength={4000}
          />
          <button type="submit" className="btn btn-primary w-full">
            Aanvraag starten
          </button>
        </form>
      </details>

      {requests.length === 0 ? (
        <p className="text-sm text-[var(--text-dim)] text-center">
          Nog geen aanvragen. Start hierboven.
        </p>
      ) : (
        <ul className="ios-list">
          {requests.map((request) => {
            const selected = request.quotes.some((q) => q.selected);
            return (
              <li
                key={request.id}
                className="border-b border-[var(--line)] last:border-0"
              >
                <Link
                  href={`/sourcing/${request.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">
                      {request.title}
                    </span>
                    <span className="block text-sm text-[var(--text-dim)] truncate">
                      {request.code}
                      {" · "}
                      {request.quantity.toLocaleString("nl-BE")} st
                      {" · "}
                      {request.quotes.length} offerte
                      {request.quotes.length === 1 ? "" : "s"}
                      {selected ? " · gekozen" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--text-dim)]">
                    {STATUS_LABEL[request.status] ?? request.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
