import { requirePageUser } from "@/lib/dal";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  createCampaign,
  updateCampaign,
} from "@/lib/campaign-actions";

export const dynamic = "force-dynamic";

/** Werkelijke campagnekost, gekoppelde leads en gewonnen omzet. */
export default async function ReclamePage() {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      leads: {
        select: {
          id: true,
          deals: {
            where: { stage: "WON" },
            select: { wonValue: true },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Reclame</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">
          Wat levert de reclame op?
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Campagnes, wat ze kosten, en welke zaken erdoor binnenkwamen.
        </p>
      </div>

      {user.role !== "reviewer" ? (
        <details className="panel p-4">
          <summary className="font-medium cursor-pointer">
            Campagne toevoegen
          </summary>
          <form
            action={createCampaign}
            className="grid gap-3 sm:grid-cols-2 mt-4"
          >
            <input
              name="name"
              className="input sm:col-span-2"
              placeholder="Campagnenaam"
              required
              maxLength={160}
            />
            <select name="objective" className="select">
              <option value="LEAD_GENERATION">Leads</option>
              <option value="SALES">Verkoop</option>
              <option value="SHOP_RENTAL">Shop-huur</option>
            </select>
            <input
              name="budget"
              type="number"
              min={0}
              step="0.01"
              className="input"
              placeholder="Budget"
              required
            />
            <input name="audience" className="input" placeholder="Doelgroep" />
            <input name="offer" className="input" placeholder="Aanbod" />
            <input name="channels" className="input" placeholder="Kanalen" />
            <input
              name="landingPage"
              type="url"
              className="input"
              placeholder="Landingspagina"
            />
            <label className="text-xs text-[var(--text-dim)]">
              Start
              <input name="startAt" type="date" className="input mt-1" />
            </label>
            <label className="text-xs text-[var(--text-dim)]">
              Einde
              <input name="endAt" type="date" className="input mt-1" />
            </label>
            <button type="submit" className="btn btn-primary sm:col-span-2">
              Campagne bewaren
            </button>
          </form>
        </details>
      ) : null}

      {campaigns.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {campaigns.map((campaign) => {
            const revenue = campaign.leads.reduce(
              (total, lead) =>
                total +
                lead.deals.reduce(
                  (sum, deal) => sum + (deal.wonValue ?? 0),
                  0
                ),
              0
            );
            return (
              <article key={campaign.id} className="panel p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="badge">{campaign.status}</span>
                    <h2 className="font-semibold mt-2">{campaign.name}</h2>
                    <p className="text-xs text-[var(--text-dim)] mt-1">
                      {[campaign.channels, campaign.audience]
                        .filter(Boolean)
                        .join(" · ") || "Nog geen kanaal of doelgroep"}
                    </p>
                  </div>
                  {campaign.landingPage ? (
                    <a
                      href={campaign.landingPage}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--accent)]"
                    >
                      Pagina ↗
                    </a>
                  ) : null}
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <Stat label="Budget" value={euro(campaign.budget)} />
                  <Stat label="Besteed" value={euro(campaign.spend)} />
                  <Stat label="Leads" value={String(campaign.leads.length)} />
                  <Stat label="Gewonnen omzet" value={euro(revenue)} />
                </dl>
                {user.role !== "reviewer" ? (
                  <form action={updateCampaign} className="flex flex-wrap gap-2">
                    <input
                      type="hidden"
                      name="campaignId"
                      value={campaign.id}
                    />
                    <select
                      name="status"
                      className="select flex-1 min-w-36"
                      defaultValue={campaign.status}
                    >
                      <option value="PLANNED">Gepland</option>
                      <option value="ACTIVE">Actief</option>
                      <option value="PAUSED">Gepauzeerd</option>
                      <option value="COMPLETED">Afgerond</option>
                    </select>
                    <input
                      name="spend"
                      type="number"
                      min={0}
                      step="0.01"
                      className="input w-32"
                      defaultValue={campaign.spend}
                      aria-label="Werkelijke kost"
                    />
                    <button type="submit" className="btn btn-sm">
                      Bijwerken
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel p-6 space-y-3">
          <div className="label text-[var(--accent)]">Nog geen campagnes</div>
          <p className="text-sm text-[var(--text-dim)] max-w-prose">
            Voeg pas een campagne toe wanneer er werkelijk budget, leads en een
            verkoopdoel zijn. Zo blijft dit een opbrengstoverzicht en geen
            contentlijst.
          </p>
        </section>
      )}

      <p className="text-sm flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/reclame/content" className="text-[var(--accent)] underline">
          Contentkalender
        </Link>
        <Link href="/reclame/materiaal" className="text-[var(--accent)] underline">
          Materiaal & PDF-sjablonen
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mono mt-1">{value}</dd>
    </div>
  );
}

function euro(value: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
