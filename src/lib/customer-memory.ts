/**
 * Customer Memory — vaste sleutels en pure helpers.
 *
 * Feiten zijn rijen, geen kolommen: zo houd je geschiedenis, bewijs en status
 * zonder bij elk nieuw soort feit te migreren. Sleutels staan hier vast zodat
 * de database geen vuilbak van vrije labels wordt.
 */

export const FACT_KEYS = [
  "beslisser",
  "bezwaar",
  "voorkeurProduct",
  "huurOfKoop",
  "aantalAutomaten",
  "volume",
  "budget",
  "betaaltermijn",
  "contractEinde",
  "locatieDetail",
  "allergie",
  "volgendeStap",
] as const;

export type FactKey = (typeof FACT_KEYS)[number];

export const FACT_LABELS: Record<FactKey, string> = {
  beslisser: "Beslisser",
  bezwaar: "Bezwaar",
  voorkeurProduct: "Voorkeur product",
  huurOfKoop: "Huur of koop",
  aantalAutomaten: "Aantal automaten",
  volume: "Volume / afname",
  budget: "Budget",
  betaaltermijn: "Betaaltermijn",
  contractEinde: "Contracteinde",
  locatieDetail: "Locatie",
  allergie: "Allergie / dieet",
  volgendeStap: "Volgende stap",
};

export const FACT_STATUSES = ["SUGGESTED", "CONFIRMED", "REJECTED"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const FACT_SOURCES = ["MAIL", "CALL", "MANUAL", "DOCUMENT"] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

export function isFactKey(value: string): value is FactKey {
  return (FACT_KEYS as readonly string[]).includes(value);
}

export function factLabel(key: string): string {
  if (isFactKey(key)) return FACT_LABELS[key];
  return key;
}

/** Trim + inkrimpen van witruimte; lege string wordt "". */
export function normaliseFactValue(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

export type SuggestedFact = {
  key: FactKey;
  value: string;
  confidence: number;
};

/**
 * Filtert AI-output tot bekende sleutels, niet-lege waarden, en confidence 0–1.
 */
export function sanitizeSuggestedFacts(
  raw: unknown
): SuggestedFact[] {
  if (!Array.isArray(raw)) return [];
  const out: SuggestedFact[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key : "";
    if (!isFactKey(key)) continue;
    const value = normaliseFactValue(String(row.value ?? ""));
    if (!value) continue;
    const confidenceRaw =
      typeof row.confidence === "number" ? row.confidence : Number(row.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0.5;
    const dedupe = `${key}|${value.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ key, value, confidence });
  }

  return out;
}
