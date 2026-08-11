/**
 * Documentnummering en het invullen van sjablonen.
 *
 * Twee dingen mogen hier niet fout gaan, en allebei zijn ze onzichtbaar tot het
 * te laat is: een nummer dat twee keer bestaat, en een contract dat met
 * `{{klant_naam}}` er nog in de deur uit gaat. Vandaar dat dit apart staat en
 * getest is.
 */

/** Herkent `{{sleutel}}`, met of zonder spaties eromheen. */
const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export type DocumentContext = Record<string, string | number | null | undefined>;

/**
 * Vult de sleutels in en laat onbekende sleutels ongemoeid staan.
 *
 * Bewust niet stilzwijgend leeg: een leeg veld in een contract ziet er normaal
 * uit en glipt er zo doorheen, terwijl `{{prijs}}` meteen opvalt. Wat er
 * ontbreekt komt via `missingPlaceholders` als blokkade naar boven.
 */
export function fillTemplate(body: string, context: DocumentContext): string {
  return body.replace(PLACEHOLDER, (match, key: string) => {
    const value = context[key.toLowerCase()];
    if (value === null || value === undefined || value === "") return match;
    return String(value);
  });
}

/** De sleutels die na het invullen nog open staan. */
export function missingPlaceholders(filled: string): string[] {
  const found = new Set<string>();
  for (const match of filled.matchAll(PLACEHOLDER)) {
    found.add(match[1].toLowerCase());
  }
  return [...found].sort();
}

/** Alle sleutels die een sjabloon nodig heeft. */
export function templateKeys(body: string): string[] {
  return missingPlaceholders(body);
}

/**
 * Bouwt het documentnummer uit een teller.
 *
 * Vorm: `PREFIX-JAAR-0001`. Het jaar zit erin zodat de teller elk jaar opnieuw
 * bij één begint zonder dat oude nummers ooit terugkomen.
 */
export function formatDocumentNumber(
  prefix: string,
  year: number,
  counter: number
): string {
  return `${prefix}-${year}-${String(counter).padStart(4, "0")}`;
}

/** Sleutel van de teller voor dit voorvoegsel en jaar. */
export function sequenceId(prefix: string, year: number): string {
  return `${prefix}-${year}`;
}

/**
 * Euro's in Belgische notatie, voor in de documenttekst zelf.
 *
 * Apart van de `euro()` in team-stats: die rondt af op hele euro's voor op een
 * dashboard, en op een factuur horen de centen te staan.
 */
export function documentAmount(amount: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Datum zoals ze in een Belgisch document geschreven wordt. */
export function documentDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export const VAT_RATE = 0.21;

export type PriceBreakdown = {
  net: number;
  vat: number;
  gross: number;
};

/**
 * Splitst een bedrag exclusief btw in netto, btw en bruto.
 *
 * Op centen afgerond, want anders telt netto plus btw niet op tot bruto en
 * struikelt de boekhouding over één cent.
 */
export function priceBreakdown(net: number, rate: number = VAT_RATE): PriceBreakdown {
  const cents = Math.round(net * 100);
  const vatCents = Math.round(cents * rate);
  return {
    net: cents / 100,
    vat: vatCents / 100,
    gross: (cents + vatCents) / 100,
  };
}
