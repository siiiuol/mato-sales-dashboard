import { prisma } from "@/lib/db";
import { saveSettings } from "@/lib/actions";
import { FLANDERS_ZONES } from "@/lib/constants";
import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageUser(["admin"]);
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  let categories: string[] = [];
  let zones: string[] = [];
  try {
    categories = JSON.parse(settings.detectionCategories);
    zones = JSON.parse(settings.enabledZones);
  } catch {
    categories = ["bakery", "butcher", "patisserie", "traiteur", "chocolatier", "florist", "farm shop"];
    zones = [...FLANDERS_ZONES];
  }

  return (
    <div className="space-y-6 anim-lock max-w-3xl">
      <div>
        <p className="label">Channel 09</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Settings</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          EUR · Europe/Brussels · lead-bot is the canonical acquisition path
        </p>
      </div>

      <section className="panel p-4 text-sm text-[var(--text-dim)] space-y-2">
        <div className="label text-[var(--accent)]">Free public-data path</div>
        <p>
          Default discovery uses <span className="mono text-[var(--text)]">KBO Open Data</span>{" "}
          + <span className="mono text-[var(--text)]">OpenStreetMap</span> (no paid Places key).
          Download a free KBO Full ZIP to{" "}
          <span className="mono text-[var(--text)]">lead-bot/data/kbo/latest.zip</span>, then:
        </p>
        <p className="mono text-[var(--text)] text-xs leading-relaxed">
          python -m lead_bot.jobs.import_kbo --path data/kbo/latest.zip --region east_west_flanders
          <br />
          python -m lead_bot.jobs.enrich_pipeline --min-preliminary 30 --limit 100
          <br />
          uvicorn lead_bot.api.main:app --port 8000
        </p>
        <p>
          Zone Scan in Leads uses Overpass when no Google key is set. See{" "}
          <span className="mono text-[var(--text)]">docs/free-data-sources.md</span>.
        </p>
      </section>

      <form action={saveSettings} className="panel p-4 sm:p-6 space-y-4">
        <div>
          <label className="label block mb-1">Business name</label>
          <input
            name="businessName"
            className="input"
            defaultValue={settings.businessName}
          />
        </div>

        <div>
          <label className="label block mb-1">
            Google Places API key (optional — leave empty for free OpenStreetMap)
          </label>
          <input
            name="placesApiKey"
            className="input mono"
            type="password"
            autoComplete="off"
            placeholder="Empty = OSM Overpass (free)"
            defaultValue={settings.placesApiKey || ""}
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Only needed if you want paid Google coverage. Scans work without it.
          </p>
        </div>

        <div>
          <label className="label block mb-1">Accent</label>
          <select name="accent" className="select" defaultValue={settings.accent}>
            <option value="green">Green terminal</option>
            <option value="cyan">Cyan ops</option>
          </select>
        </div>

        <div>
          <label className="label block mb-1">Detection categories (comma-separated)</label>
          <input
            name="categories"
            className="input"
            defaultValue={categories.join(", ")}
          />
        </div>

        <div>
          <label className="label block mb-2">Enabled zones</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FLANDERS_ZONES.map((z) => (
              <label key={z} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="zones"
                  value={z}
                  defaultChecked={zones.includes(z)}
                />
                {z}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label block mb-1">Customer exclusion radius (km)</label>
          <input
            name="exclusionRadiusKm"
            type="number"
            step="0.1"
            className="input"
            defaultValue={settings.exclusionRadiusKm}
          />
        </div>

        <div>
          <label className="label block mb-1">Pitch templates (JSON)</label>
          <textarea
            name="pitchTemplates"
            className="textarea mono text-sm"
            defaultValue={settings.pitchTemplates}
            rows={8}
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Save settings
        </button>
      </form>
    </div>
  );
}
