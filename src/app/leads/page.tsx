import { prisma } from "@/lib/db";
import {
  contactLead,
  createLead,
  releaseLead,
  skipLead,
  takeLead,
  unskipLead,
} from "@/lib/actions";
import { TriageButtons } from "@/components/TriageButtons";
import { OwnerButton } from "@/components/OwnerButton";
import { LEAD_STATUSES, statusLabel, categoryLabel } from "@/lib/constants";
import { FLANDERS_ZONES } from "@/lib/constants";
import { LeadsMap } from "@/components/LeadsMap";
import { LeadSearchPanel } from "@/components/LeadSearchPanel";
import { requirePageUser } from "@/lib/dal";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LeadFilters = {
  province?: string;
  status?: string;
  category?: string;
  city?: string;
};

function hrefWith(sp: LeadFilters, overrides: LeadFilters) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<LeadFilters>;
}) {
  const user = await requirePageUser(["admin", "sales", "reviewer"]);
  const sp = await searchParams;
  const where = {
    ...(sp.province ? { province: sp.province } : {}),
    ...(sp.status ? { status: sp.status as never } : {}),
    ...(sp.category ? { category: sp.category } : {}),
    ...(sp.city ? { city: sp.city } : {}),
  };

  const [leads, wonLeads, runs, settings, categoryRows, cityRows] = await Promise.all([
    prisma.lead.findMany({
      where,
      // Op ranking, net als de bel- en selecteerwachtrij. Met een limiet van
      // 200 op ruim duizend leads bepaalt deze volgorde wélke je te zien
      // krijgt: de beste, niet toevallig de laatst gevondene.
      //
      // De score bevat het buurtsignaal al; hier staat het er alleen als
      // gelijkspelbreker bij, zodat twee zaken met dezelfde score op volgorde
      // van bewijs staan en niet op datum.
      orderBy: [
        { hasVending: "desc" },
        { score: "desc" },
        { nearbyVending: "desc" },
        { createdAt: "desc" },
      ],
      take: 200,
      include: { owner: { select: { id: true, name: true } } },
    }),
    prisma.lead.findMany({
      where: { status: "WON", lat: { not: null }, lng: { not: null } },
      select: { id: true, name: true, lat: true, lng: true },
      take: 200,
    }),
    prisma.detectionRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
    prisma.appSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    }),
    prisma.lead.findMany({
      where: { category: { not: null } },
      distinct: ["category"],
      select: { category: true },
    }),
    prisma.lead.findMany({
      where: { city: { not: null } },
      distinct: ["city"],
      select: { city: true },
    }),
  ]);

  const categories = categoryRows
    .map((r) => r.category!)
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  const cities = cityRows
    .map((r) => r.city!)
    .sort((a, b) => a.localeCompare(b));

  let enabledZones: string[] = [...FLANDERS_ZONES];
  try {
    const parsed = JSON.parse(settings.enabledZones || "[]");
    if (Array.isArray(parsed) && parsed.length) {
      enabledZones = parsed.filter((z: string) =>
        (FLANDERS_ZONES as readonly string[]).includes(z)
      );
      if (!enabledZones.length) enabledZones = [...FLANDERS_ZONES];
    }
  } catch {
    enabledZones = [...FLANDERS_ZONES];
  }

  const mapLeads = leads
    .filter((l) => l.lat != null && l.lng != null && l.status !== "WON")
    .map((l) => ({
      id: l.id,
      name: l.name,
      lat: l.lat!,
      lng: l.lng!,
      score: l.score,
      type: "lead" as const,
    }));

  const mapWon = wonLeads.map((l) => ({
    id: l.id,
    name: l.name,
    lat: l.lat!,
    lng: l.lng!,
    score: 100,
    type: "won" as const,
  }));

  return (
    <div className="space-y-6 anim-lock">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="label">Overzicht</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Leads</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Zoek per zone in Vlaanderen · {leads.length} in beeld
          </p>
        </div>
        <Link href="/" className="btn">
          Naar Werk
        </Link>
      </div>

      <LeadSearchPanel zones={enabledZones} />

      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefWith(sp, { status: undefined })}
          className={`badge ${!sp.status ? "badge-live" : ""}`}
        >
          alles
        </Link>
        {LEAD_STATUSES.map((s2) => (
          <Link
            key={s2}
            href={hrefWith(sp, { status: s2 })}
            className={`badge ${sp.status === s2 ? "badge-live" : ""}`}
          >
            {statusLabel(s2)}
          </Link>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        {sp.province && <input type="hidden" name="province" value={sp.province} />}
        <div>
          <label className="label block mb-1">Categorie</label>
          <select name="category" className="select" defaultValue={sp.category ?? ""}>
            <option value="">Alle categorieën</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label block mb-1">Gemeente</label>
          <select name="city" className="select" defaultValue={sp.city ?? ""}>
            <option value="">Alle gemeenten</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Filteren
        </button>
        {(sp.category || sp.city) && (
          <Link
            href={hrefWith(sp, { category: undefined, city: undefined })}
            className="btn btn-ghost"
          >
            Wis categorie/gemeente
          </Link>
        )}
      </form>

      <section className="panel p-2 sm:p-3">
        <div className="label px-2 py-1 mb-2">
          Kaart · {mapLeads.length + mapWon.length} locaties
        </div>
        <LeadsMap points={[...mapLeads, ...mapWon]} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Score</th>
                <th>Lead</th>
                <th>Zone</th>
                <th>Telefoon</th>
                <th>Status</th>
                <th>Van wie</th>
                <th>Actie</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-[var(--text-dim)] text-sm py-6">
                    Nog geen leads. Klik hierboven op Leads zoeken om zaken in deze lijst
                    en op de kaart te krijgen.
                  </td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="score anim-lock">{l.score}</td>
                  <td>
                    <Link
                      href={`/leads/${l.id}`}
                      className="font-medium hover:text-[var(--accent)]"
                    >
                      {l.name}
                    </Link>
                    <div className="text-xs text-[var(--text-dim)]">
                      {l.city ? `${l.city} · ` : ""}{l.reason}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {l.hasVending && (
                        <span className="badge badge-live">Heeft automaat</span>
                      )}
                      {l.nearbyVending > 0 && (
                        <span className="badge" title="Automaten binnen 1,5 km die niet van deze zaak zijn">
                          {l.nearbyVending === 1
                            ? "Buur heeft automaat"
                            : `${l.nearbyVending} automaten in de buurt`}
                        </span>
                      )}
                      {l.sellsTakeaway && <span className="badge">Afhaal</span>}
                    </div>
                  </td>
                  <td className="text-sm">{l.province ?? "—"}</td>
                  <td className="mono text-xs">
                    {l.phone ? (
                      <a href={`tel:${l.phone}`} className="text-[var(--accent)]">
                        {l.phone}
                      </a>
                    ) : (
                      <span className="text-[var(--text-mute)]">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge">{statusLabel(l.status)}</span>
                  </td>
                  <td>
                    <OwnerButton
                      leadId={l.id}
                      ownerId={l.ownerId}
                      ownerName={l.owner?.name ?? null}
                      currentUserId={user.id}
                      isAdmin={user.role === "admin"}
                      takeAction={takeLead}
                      releaseAction={releaseLead}
                      compact
                    />
                  </td>
                  <td>
                    <TriageButtons
                      leadId={l.id}
                      status={l.status}
                      complianceStatus={l.complianceStatus}
                      contactAction={contactLead}
                      skipAction={skipLead}
                      unskipAction={unskipLead}
                      compact
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-4">
          <section className="panel p-4">
            <h2 className="label text-[var(--accent)] mb-3">Lead toevoegen</h2>
            <form action={createLead} className="space-y-2">
              <input name="name" className="input" placeholder="Bedrijfsnaam" required />
              <input name="phone" className="input" placeholder="Telefoon" />
              <input name="city" className="input" placeholder="Gemeente" />
              <select name="province" className="select" defaultValue="">
                <option value="">Provincie</option>
                {FLANDERS_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <input name="category" className="input" placeholder="Categorie" />
              <button type="submit" className="btn btn-primary w-full">
                Lead toevoegen
              </button>
            </form>
          </section>

          <section className="panel p-4">
            <h2 className="label text-[var(--accent)] mb-3">Recente zoekopdrachten</h2>
            <ul className="space-y-2 text-sm">
              {runs.length === 0 && (
                <li className="text-[var(--text-dim)]">Nog niet gezocht.</li>
              )}
              {runs.map((r) => (
                <li key={r.id} className="border-b border-[var(--border)] pb-2">
                  <div className="flex justify-between">
                    <span className="mono">{r.zone}</span>
                    <span className="badge badge-live">{r.status}</span>
                  </div>
                  <div className="text-[var(--text-dim)] text-xs mt-1">
                    +{r.createdCount} nieuw / {r.skippedCount} al bekend
                    {r.detail ? ` · ${r.detail}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
