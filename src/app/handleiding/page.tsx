import Link from "next/link";
import { requirePageUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    id: "vandaag",
    title: "Vandaag",
    href: "/",
    steps: [
      "Open Vandaag voor open leads op uw naam, taken en wat vandaag opvolging vraagt.",
      "Gebruik Belmodus of open een leadfiche voor de volgende stap.",
      "Datakwaliteit staat inklapbaar onderaan — alleen openen als u gaten wilt dichten.",
    ],
  },
  {
    id: "belmodus",
    title: "Belmodus",
    href: "/bellen",
    steps: [
      "Belmodus toont de volgende te bellen lead zonder de lijst te doorzoeken.",
      "Noteer het resultaat op de fiche (Contact noteren) zodat de geschiedenis klopt.",
    ],
  },
  {
    id: "leads",
    title: "Leads & triage",
    href: "/leads",
    steps: [
      "Zoek of filter leads, voeg een zaak toe aan uw naam, of open triage voor compliance.",
      "Eigenaarschap bepaalt wie contracten en teamchat mag bijwerken.",
    ],
  },
  {
    id: "fiche",
    title: "Leadfiche & teamchat",
    href: "/leads",
    steps: [
      "De sticky actiestrook bovenaan: eigenaar, triage, mail, document, teamchat.",
      "Contact noteren = klantcontact. Teamchat = intern overleg (wijzigt de status niet).",
      "Mail, deals en documenten zitten in de rechterkolom; geschiedenis onderaan.",
    ],
  },
  {
    id: "mail",
    title: "Mail",
    href: "/settings",
    steps: [
      "Koppel uw Microsoft-mailbox onder Instellingen (beheerder/medewerker).",
      "Op de leadfiche: concept opstellen, versturen, antwoorden synchroniseren.",
    ],
  },
  {
    id: "deals",
    title: "Deals & gewonnen",
    href: "/deals",
    steps: [
      "Maak of werk een deal bij op de leadfiche; gewonnen deals tonen omzet.",
      "Het overzicht Deals toont het kanban-/pijplijnbeeld voor het team.",
    ],
  },
  {
    id: "documenten",
    title: "Documenten & live preview",
    href: "/reclame/materiaal",
    steps: [
      "Koopcontract: op de leadfiche onder Documenten — rechts ziet u live het voorbeeld.",
      "Materiaal/factuur: Reclame → Materiaal → sjabloon invullen; preview volgt terwijl u typt.",
      "Productfoto’s beheert u onder Instellingen → Producten (beheerder); ze verschijnen klein op factuur/koopdocument.",
      "Na opslaan opent het genummerde document; PDF via afdrukken blijft beschikbaar.",
    ],
  },
  {
    id: "shop",
    title: "Shop",
    href: "/shop",
    steps: [
      "Shop toont plaatsen in Diksmuide en huurders.",
      "Nieuwe huurder start u met de knop op de shoppagina (niet meer in de hoofdnavigatie).",
    ],
  },
  {
    id: "team",
    title: "Team & instellingen",
    href: "/team",
    steps: [
      "Beheerders zien Team en Instellingen in de balk.",
      "Medewerkers, commissie, scaninstellingen en productcatalogus horen hier thuis.",
    ],
  },
  {
    id: "backup",
    title: "Back-up",
    href: "/settings",
    steps: [
      "Databaseback-ups lopen via de geplande GitHub-workflow (zie repository).",
      "Bewaar geen geheimen in git; gebruik omgevingsvariabelen op Vercel.",
    ],
  },
] as const;

/**
 * In-app handleiding — ankersecties met deep links, geen PDF.
 */
export default async function HandleidingPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);

  return (
    <div className="space-y-8 anim-lock max-w-3xl">
      <div>
        <p className="label">MATO OS</p>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Handleiding
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-2">
          Korte stappen voor de hoofdflows. Geen prijzen of beloftes — alleen hoe
          het OS werkt. Meelezers mogen dit ook lezen.
        </p>
      </div>

      <nav className="panel p-4">
        <p className="label text-[var(--accent)] mb-2">Inhoud</p>
        <ul className="columns-1 sm:columns-2 gap-4 text-sm space-y-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-[var(--accent)] hover:underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="panel p-5 space-y-3 scroll-mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <Link href={section.href} className="btn btn-sm">
              Open scherm
            </Link>
          </div>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-[var(--text-dim)]">
            {section.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
