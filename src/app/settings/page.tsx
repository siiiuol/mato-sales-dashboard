import { prisma } from "@/lib/db";
import { saveSettings } from "@/lib/actions";
import { FLANDERS_ZONES } from "@/lib/constants";
import { requirePageUser } from "@/lib/dal";
import { SecretField } from "@/components/SecretField";
import { MailboxPanel } from "@/components/MailboxPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ mailbox?: string; mailbox_ok?: string }>;
}) {
  const user = await requirePageUser(["admin"]);
  const { mailbox: mailboxError, mailbox_ok: mailboxOk } = await searchParams;
  const connection = await prisma.mailboxConnection.findUnique({
    where: { userId: user.id },
  });
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
        <p className="label">Beheer</p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Instellingen</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          EUR · Europe/Brussels · zoeken werkt standaard op gratis OpenStreetMap-data
        </p>
      </div>

      <section className="panel p-4 text-sm text-[var(--text-dim)] space-y-2">
        <div className="label text-[var(--accent)]">Hoe het zoeken werkt</div>
        <p>
          Met een Google Places-sleutel hieronder doorzoekt een zone elke gemeente
          op bakkerijen, patisserieën, slagerijen, chocolatiers, ijssalons,
          traiteurs, hoevewinkels en afhaalzaken — enkel zelfstandige zaken, geen
          supermarktketens. Ongeveer negen op de tien hebben een telefoonnummer.
        </p>
        <p>
          Het net staat bewust wijd open: er wordt niets weggelaten op grond van
          categorie, alleen anders gewogen. Zaken die al een automaat hebben staan
          bovenaan — bewezen kopers — en daarna wie er een bij de buren in de
          straat heeft staan. Wie te streng filtert houdt een korte lijst over die
          er goed uitziet, en mist de zaak die net niet in het hokje paste.
        </p>
        <p>
          Laat je de sleutel leeg, dan valt de app terug op{" "}
          <span className="mono text-[var(--text)]">OpenStreetMap</span>: gratis,
          maar trager, met minder dekking en een telefoonnummer bij slechts
          ongeveer een derde. Mislukt Places, dan schakelt de app automatisch over
          en zegt waarom.
        </p>
        <p>
          In beide gevallen zoekt de app ook op OpenStreetMap naar zaken die al
          een automaat hebben en zet die bovenaan — dat zijn bewezen kopers.
          Dezelfde zone twee keer zoeken levert nooit dubbels op.
        </p>
      </section>

      <MailboxPanel
        connection={connection}
        error={mailboxError}
        connected={mailboxOk}
        configured={Boolean(settings.msClientId && settings.msTenantId && settings.msClientSecret)}
      />

      <form action={saveSettings} className="panel p-4 sm:p-6 space-y-4">
        <div>
          <label className="label block mb-1">Bedrijfsnaam</label>
          <input
            name="businessName"
            className="input"
            defaultValue={settings.businessName}
          />
        </div>

        <SecretField
          name="placesApiKey"
          label="Google Places API-sleutel (optioneel — leeg = gratis OpenStreetMap)"
          stored={settings.placesApiKey}
          hint="Alleen nodig voor de betalende Google-dekking. Zoeken werkt ook zonder."
        />

        <SecretField
          name="anthropicApiKey"
          label="Anthropic API-sleutel (voor het opstellen van mails)"
          stored={settings.anthropicApiKey}
          hint="Staat in de database, nooit in de code. Zonder sleutel werkt de rest van de app gewoon; alleen “Mail opstellen” op de leadfiche valt weg."
        />

        <div>
          <label className="label block mb-1">Anthropic-model</label>
          <input
            name="anthropicModel"
            className="input mono"
            placeholder="claude-opus-5"
            defaultValue={settings.anthropicModel || ""}
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Instelbaar omdat Anthropic regelmatig nieuwe modellen uitbrengt.
            Bestaat het model niet voor jouw sleutel, dan zegt de foutmelding dat.
          </p>
        </div>

        <fieldset className="space-y-4 border-t border-[var(--line)] pt-4">
          <legend className="label text-[var(--accent)]">
            Microsoft 365 (voor het versturen van mail)
          </legend>
          <p className="text-xs text-[var(--text-dim)]">
            Uit de app-registratie in Entra. De omleidings-URI daar moet exact{" "}
            <span className="mono text-[var(--text)]">
              {"<jouw-adres>"}/api/mail/callback
            </span>{" "}
            zijn, anders weigert Microsoft de koppeling.
          </p>

          <div>
            <label className="label block mb-1" htmlFor="msTenantId">
              Tenant-id
            </label>
            <input
              id="msTenantId"
              name="msTenantId"
              className="input mono"
              placeholder="00000000-0000-0000-0000-000000000000"
              defaultValue={settings.msTenantId || ""}
            />
          </div>

          <div>
            <label className="label block mb-1" htmlFor="msClientId">
              Client-id (toepassings-id)
            </label>
            <input
              id="msClientId"
              name="msClientId"
              className="input mono"
              placeholder="00000000-0000-0000-0000-000000000000"
              defaultValue={settings.msClientId || ""}
            />
          </div>

          <SecretField
            name="msClientSecret"
            label="Clientgeheim"
            masked={settings.msClientSecret ? "•••••••• bewaard" : undefined}
            hint="Versleuteld opgeslagen. Entra toont de waarde maar één keer, bij het aanmaken — vervalt hij, maak dan een nieuw geheim aan en plak dat hier."
          />
        </fieldset>

        <div>
          <label className="label block mb-1">Categorieën om te zoeken (komma-gescheiden)</label>
          <input
            name="categories"
            className="input"
            defaultValue={categories.join(", ")}
          />
        </div>

        <div>
          <label className="label block mb-2">Actieve zones</label>
          {/* Alle vakjes uitvinken stuurt niets mee; dit veld zegt dat de lijst
              wél op het formulier stond, zodat "geen" ook echt geen betekent. */}
          <input type="hidden" name="zones_present" value="1" />
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
          <label className="label block mb-1">Uitsluitingsstraal rond klanten (km)</label>
          <input
            name="exclusionRadiusKm"
            type="number"
            step="0.1"
            className="input"
            defaultValue={settings.exclusionRadiusKm}
          />
        </div>

        <div>
          <label className="label block mb-1">Belscripts (JSON)</label>
          <textarea
            name="pitchTemplates"
            className="textarea mono text-sm"
            defaultValue={settings.pitchTemplates}
            rows={8}
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Instellingen opslaan
        </button>
      </form>
    </div>
  );
}
