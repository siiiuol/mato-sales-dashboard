/**
 * Officiële MATO-productkennis — afgestemd op matoautomaat.be/catalogus.
 *
 * Prijzen: alleen noemen wat de site publiek maakt. Rest = op aanvraag.
 * Bron: https://www.matoautomaat.be (catalogus + diensten).
 */

export type CatalogProduct = {
  sku: string;
  name: string;
  line: "MACHINE" | "BEHUIZING" | "PACKAGING" | "TERMINAL" | "TELEMETRY";
  description: string;
  specs: string;
  /** 0 = prijs op aanvraag (site). */
  listPrice: number;
  cost: number;
  recurring?: boolean;
};

/** Selectiegids zoals op de website — voor AI-prompts en Assistent. */
export const MATO_CATALOG_GUIDE = `MATO-catalogus (matoautomaat.be) — hoe kies je een automaat:
- Fragiel (brood, gebak, taart): liftsysteem → B1, M1 of S1. Zonder lift beschadigt het product.
- Blikjes/flessen: valsysteem → C1 (instap, publiek genoemd rond €6.500 excl. — altijd bevestigen).
- Diepvries/ijs (tot −20 °C, schuifbak): F1.
- Losse vakken / locker (bloemen, taart per stuk, cadeaus): L1, indeling op maat.
- Groot assortiment / meerdere producten in één aankoop: T1 (touchscreen).
- Bij twijfel: vraag wat ze verkopen en waar de automaat komt; adviseer eerlijk, ook een goedkoper model.

Ook leverbaar naast de automaat: behuizing/wrapping, verpakking, betaalterminals, telemetrie.
Drie groeipaden op de site: (1) eigen verkooppunt met automaat, (2) concept uitbouwen (automaat + verpakking/productie/behuizing), (3) productpartner in de MATO Automatenshop Diksmuide.
Beschikbaarheid, uitvoering en prijs altijd bevestigen na contact — catalogus is informatief.`;

export const MATO_CATALOG: CatalogProduct[] = [
  {
    sku: "MATO-B1",
    name: "MATO B1",
    line: "MACHINE",
    description:
      "Verkoopautomaat met liftsysteem voor fragiele producten (brood, gebak, taart).",
    specs: "lift · gekoeld/ambient afhankelijk van uitvoering · food",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-M1",
    name: "MATO M1",
    line: "MACHINE",
    description:
      "Verkoopautomaat met liftsysteem voor fragiele producten — middelgroot gamma.",
    specs: "lift · food · middenformaat",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-S1",
    name: "MATO S1",
    line: "MACHINE",
    description:
      "Verkoopautomaat met liftsysteem voor fragiele producten — compact/selectie.",
    specs: "lift · food · compact",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-C1",
    name: "MATO C1",
    line: "MACHINE",
    description:
      "Verkoopautomaat met valsysteem voor blikjes en flessen. Instapmodel.",
    specs: "val · drank · instap",
    listPrice: 6500,
    cost: 0,
  },
  {
    sku: "MATO-F1",
    name: "MATO F1",
    line: "MACHINE",
    description:
      "Diepvriesautomaat tot −20 °C met schuifbak — ijs en diepvriesproducten.",
    specs: "diepvries · −20 °C · schuifbak",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-L1",
    name: "MATO L1",
    line: "MACHINE",
    description:
      "Gekoelde lockervakken op maat — bloemen, taarten per stuk, cadeaus.",
    specs: "locker · gekoeld · indeling op maat",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-T1",
    name: "MATO T1",
    line: "MACHINE",
    description:
      "Touchscreen-automaat: klant bestelt op scherm en rekent meerdere producten af.",
    specs: "touchscreen · groot assortiment",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-BEH-STD",
    name: "Behuizing / wrapping op maat",
    line: "BEHUIZING",
    description:
      "Behuizing en wrapping afgestemd op het concept (zichtbaarheid, branding, bescherming).",
    specs: "op maat · branding",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-PKG",
    name: "Verpakkingsoplossingen",
    line: "PACKAGING",
    description:
      "Verpakking voor producten in de automaat — afgestemd op assortiment en houdbaarheid.",
    specs: "op maat · food",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-PAY",
    name: "Betaalterminal",
    line: "TERMINAL",
    description:
      "Betaaloplossing voor de automaat (cashless). Exacte uitvoering na advies.",
    specs: "contactloos · catalogus Betaalterminals",
    listPrice: 0,
    cost: 0,
  },
  {
    sku: "MATO-TEL",
    name: "Telemetrie",
    line: "TELEMETRY",
    description:
      "Opvolging van verkoop, voorraad en prestaties op afstand.",
    specs: "remote · catalogus Telemetrie",
    listPrice: 0,
    cost: 0,
    recurring: false,
  },
];

/** SKU’s van de oude demo-catalogus — deactiveren bij sync. */
export const LEGACY_PRODUCT_SKUS = [
  "MCH-SNK-6",
  "MCH-DRK-8",
  "BEH-SL-M",
  "BEH-SL-L",
  "PKG-STD",
  "TRM-PP-1",
  "TRM-PP-C",
  "TEL-HUB",
  "TEL-PLAN",
] as const;

/**
 * Eerste machine-advies op basis van leadcategorie / signalen.
 * Geen prijsclaim — alleen modelhint zoals op de site.
 */
export function suggestMachineHint(input: {
  category?: string | null;
  sellsTakeaway?: boolean;
  hasVending?: boolean;
}): string {
  const cat = (input.category ?? "").toLowerCase();
  if (
    cat.includes("ice") ||
    cat.includes("ijs") ||
    cat.includes("gelato")
  ) {
    return "F1 (diepvries/ijs)";
  }
  if (cat.includes("florist") || cat.includes("bloem") || cat.includes("gift")) {
    return "L1 (lockervakken)";
  }
  if (
    cat.includes("bakery") ||
    cat.includes("patisserie") ||
    cat.includes("chocolat") ||
    cat.includes("butcher") ||
    cat.includes("traiteur") ||
    cat.includes("cheese") ||
    cat.includes("farm")
  ) {
    return "B1 / M1 / S1 (lift — fragiel food)";
  }
  if (cat.includes("drink") || cat.includes("drank") || cat.includes("café")) {
    return "C1 (blik/fles) of T1 bij groot assortiment";
  }
  if (input.sellsTakeaway) {
    return "B1 / M1 / S1 of T1 — afhankelijk van fragiliteit en assortiment";
  }
  if (input.hasVending) {
    return "bestaande automaat bespreken; mogelijk tweede toestel of upgrade (T1/L1/…)";
  }
  return "advies na wat ze verkopen (lift vs val vs diepvries vs locker vs touch)";
}

export function formatCatalogPrice(listPrice: number): string {
  if (!listPrice || listPrice <= 0) return "prijs op aanvraag";
  return `indicatief € ${listPrice.toLocaleString("nl-BE")} excl. (bevestigen)`;
}

/** Korte lijst voor prompts. */
export function catalogPromptBlock(
  products: Array<{ name: string; line: string; listPrice: number; description?: string | null }>
): string {
  if (!products.length) {
    return `${MATO_CATALOG_GUIDE}\n\n(Geen producten in de database — gebruik alleen de gids hierboven, geen verzonnen prijzen.)`;
  }
  const lines = products.map((p) => {
    const price = formatCatalogPrice(p.listPrice);
    const desc = p.description ? ` — ${p.description}` : "";
    return `- ${p.name} [${p.line}]: ${price}${desc}`;
  });
  return `${MATO_CATALOG_GUIDE}\n\nActieve catalogus in MATO OS:\n${lines.join("\n")}`;
}
