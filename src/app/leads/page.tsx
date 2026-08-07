import { prisma } from "@/lib/db";
import { contactLead, createLead, skipLead, unskipLead } from "@/lib/actions";
import { TriageButtons } from "@/components/TriageButtons";
import { LEAD_STATUSES } from "@/lib/constants";
import { FLANDERS_ZONES } from "@/lib/constants";
import { LeadsMap } from "@/components/LeadsMap";
import { LeadSearchPanel } from "@/components/LeadSearchPanel";
import { requirePageUser } from "@/lib/dal";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ province?: string; status?: string }>;
}) {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const sp = await searchParams;
  const where = {
    ...(sp.province ? { province: sp.province } : {}),
    ...(sp.status ? { status: sp.status as never } : {}),
  };

  const [leads, wonLeads, runs, settings] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
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
  ]);

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
          <p className="label">Overview</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Leads</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Search Flanders zones · map markers · {leads.length} in view
          </p>
        </div>
        <Link href="/" className="btn">
          Go to Work
        </Link>
      </div>

      <LeadSearchPanel zones={enabledZones} />

      <div className="flex flex-wrap gap-2">
        <Link href="/leads" className={`badge ${!sp.status ? "badge-live" : ""}`}>
          all
        </Link>
        {LEAD_STATUSES.map((s2) => (
          <Link
            key={s2}
            href={`/leads?status=${s2}`}
            className={`badge ${sp.status === s2 ? "badge-live" : ""}`}
          >
            {s2.replaceAll("_", " ").toLowerCase()}
          </Link>
        ))}
      </div>

      <section className="panel p-2 sm:p-3">
        <div className="label px-2 py-1 mb-2">
          Map · {mapLeads.length + mapWon.length} locations
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
                <th>Phone</th>
                <th>Status</th>
                <th>Triage</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-[var(--text-dim)] text-sm py-6">
                    No leads yet. Press Search for leads above to pull OpenStreetMap shops
                    into this list and onto the map.
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
                    {l.hasVending && (
                      <span className="badge badge-live mt-1">Has vending</span>
                    )}
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
                    <span className="badge">{l.status}</span>
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
            <h2 className="label text-[var(--accent)] mb-3">Manual lead</h2>
            <form action={createLead} className="space-y-2">
              <input name="name" className="input" placeholder="Company name" required />
              <input name="phone" className="input" placeholder="Phone" />
              <input name="city" className="input" placeholder="City" />
              <select name="province" className="select" defaultValue="">
                <option value="">Province</option>
                {FLANDERS_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <input name="category" className="input" placeholder="Category" />
              <button type="submit" className="btn btn-primary w-full">
                Add lead
              </button>
            </form>
          </section>

          <section className="panel p-4">
            <h2 className="label text-[var(--accent)] mb-3">Detection runs</h2>
            <ul className="space-y-2 text-sm">
              {runs.length === 0 && (
                <li className="text-[var(--text-dim)]">No scans yet.</li>
              )}
              {runs.map((r) => (
                <li key={r.id} className="border-b border-[var(--border)] pb-2">
                  <div className="flex justify-between">
                    <span className="mono">{r.zone}</span>
                    <span className="badge badge-live">{r.status}</span>
                  </div>
                  <div className="text-[var(--text-dim)] text-xs mt-1">
                    +{r.createdCount} / skip {r.skippedCount}
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
