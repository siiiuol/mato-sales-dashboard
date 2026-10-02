/**
 * Rangschikking van open zaken op wat vandaag het meeste oplevert.
 *
 * Puur — geen Prisma, geen "server-only". Zelfde patroon als cadences.ts en
 * team-stats.ts: de formule ligt hier vast met tests, de pagina levert alleen
 * de invoer. Gewichten staan in één constante bovenaan zodat bijsturen één
 * regel is en niet een zoektocht door de UI.
 */

/** Fase-gewichten: hoe dichter bij de handtekening, hoe zwaarder. */
export const STAGE_WEIGHT: Record<string, number> = {
  NEGOTIATION: 1.4,
  PROPOSAL: 1.2,
  QUALIFIED: 1.0,
  // WON/LOST horen niet in de wachtrij; 0 zodat ze onderaan belanden als ze
  // per ongeluk meekomen.
  WON: 0,
  LOST: 0,
};

/**
 * Alle knoppen van de formule op één plaats.
 *
 * `valuePerEuro` — hoeveel scorepunten één euro verwachte waarde waard is.
 * `overdueBoost` — vaste bonus als de actiedatum vóór vandaag ligt.
 * `dueTodayBoost` — kleinere bonus als de actie vandaag valt.
 * `unansweredInboundBoost` — bonus als er een inbound mail is zonder antwoord.
 * `silencePenaltyPerDay` — aftrek per volle stilte-dag sinds lastTouchedAt,
 *   begrensd door `maxSilenceDays` zodat een vergeten zaak niet oneindig
 *   wegzakt.
 * `baseLeadScoreScale` — hoe zwaar de bestaande Lead.score meespeelt wanneer
 *   er nog geen dealwaarde is.
 */
export const NBA_WEIGHTS = {
  valuePerEuro: 0.001,
  overdueBoost: 40,
  dueTodayBoost: 20,
  unansweredInboundBoost: 35,
  silencePenaltyPerDay: 0.5,
  maxSilenceDays: 60,
  baseLeadScoreScale: 0.15,
} as const;

export type NbaInput = {
  id: string;
  /** Lead.score — bruikbaar als er nog geen dealwaarde is. */
  leadScore?: number;
  nextActionAt: Date | null;
  lastTouchedAt?: Date | null;
  /** Verwachte dealwaarde in euro (expectedValue × probability/100, of expectedValue). */
  expectedValue?: number;
  /** Deal-fase; onbekende fases vallen terug op QUALIFIED-gewicht. */
  dealStage?: string | null;
  /** True als er een inbound mail is waar wij nog niet op geantwoord hebben. */
  hasUnansweredInbound?: boolean;
};

export type NbaResult = {
  id: string;
  score: number;
  /** Eén Nederlandse regel die de verkoper op Vandaag ziet. */
  reason: string;
};

function dayBounds(now: Date): { startOfToday: Date; startOfTomorrow: Date } {
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
  return { startOfToday, startOfTomorrow };
}

function silenceDays(lastTouchedAt: Date | null | undefined, now: Date): number {
  if (!lastTouchedAt) return 0;
  const ms = now.getTime() - lastTouchedAt.getTime();
  if (ms <= 0) return 0;
  return Math.min(
    Math.floor(ms / (24 * 60 * 60 * 1000)),
    NBA_WEIGHTS.maxSilenceDays
  );
}

/**
 * Score + reden voor één zaak.
 *
 * Deterministisch: dezelfde invoer geeft altijd dezelfde score. Geen AI.
 */
export function scoreLead(input: NbaInput, now: Date = new Date()): NbaResult {
  const { startOfToday, startOfTomorrow } = dayBounds(now);
  const w = NBA_WEIGHTS;

  const stage = input.dealStage ?? "QUALIFIED";
  const stageWeight = STAGE_WEIGHT[stage] ?? STAGE_WEIGHT.QUALIFIED;
  const value = Math.max(0, input.expectedValue ?? 0);
  const valueScore = value * w.valuePerEuro * stageWeight;

  const leadScorePart = (input.leadScore ?? 0) * w.baseLeadScoreScale;

  let dueBoost = 0;
  let dueLabel: string | null = null;
  if (input.nextActionAt && input.nextActionAt < startOfToday) {
    dueBoost = w.overdueBoost;
    dueLabel = "Te laat";
  } else if (
    input.nextActionAt &&
    input.nextActionAt >= startOfToday &&
    input.nextActionAt < startOfTomorrow
  ) {
    dueBoost = w.dueTodayBoost;
    dueLabel = "Vandaag";
  }

  const inboundBoost = input.hasUnansweredInbound
    ? w.unansweredInboundBoost
    : 0;

  const quiet = silenceDays(input.lastTouchedAt, now);
  const silencePenalty = quiet * w.silencePenaltyPerDay;

  const score =
    Math.round(
      (valueScore + leadScorePart + dueBoost + inboundBoost - silencePenalty) *
        10
    ) / 10;

  const reason = buildReason({
    dueLabel,
    value,
    stage,
    hasUnansweredInbound: Boolean(input.hasUnansweredInbound),
    quietDays: quiet,
  });

  return { id: input.id, score, reason };
}

function buildReason(opts: {
  dueLabel: string | null;
  value: number;
  stage: string;
  hasUnansweredInbound: boolean;
  quietDays: number;
}): string {
  if (opts.hasUnansweredInbound) {
    return opts.value > 0
      ? `Mail binnen · €${Math.round(opts.value).toLocaleString("nl-BE")}`
      : "Mail binnen, nog geen antwoord";
  }
  if (opts.dueLabel === "Te laat") {
    return opts.value > 0
      ? `Te laat · €${Math.round(opts.value).toLocaleString("nl-BE")}`
      : "Te laat — eerst bellen";
  }
  if (opts.dueLabel === "Vandaag") {
    return opts.value > 0
      ? `Vandaag · €${Math.round(opts.value).toLocaleString("nl-BE")}`
      : "Vandaag opvolgen";
  }
  if (opts.stage === "NEGOTIATION" && opts.value > 0) {
    return `In onderhandeling · €${Math.round(opts.value).toLocaleString("nl-BE")}`;
  }
  if (opts.stage === "PROPOSAL" && opts.value > 0) {
    return `Voorstel open · €${Math.round(opts.value).toLocaleString("nl-BE")}`;
  }
  if (opts.value > 0) {
    return `€${Math.round(opts.value).toLocaleString("nl-BE")} verwacht`;
  }
  if (opts.quietDays >= 14) {
    return `${opts.quietDays} dagen stil`;
  }
  return "Open zaak";
}

/**
 * Sorteert zaken van hoogste naar laagste score.
 * Bij gelijke score: eerst de oudste nextActionAt, dan id voor stabiliteit.
 */
export function rankLeads(
  inputs: readonly NbaInput[],
  now: Date = new Date()
): NbaResult[] {
  const scored = inputs.map((input) => scoreLead(input, now));
  const byId = new Map(inputs.map((i) => [i.id, i]));

  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDue = byId.get(a.id)?.nextActionAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = byId.get(b.id)?.nextActionAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Verwachte waarde die de ranking gebruikt: expectedValue × probability/100
 * wanneer probability gezet is, anders expectedValue, anders wonValue.
 */
export function dealExpectedEuro(deal: {
  expectedValue?: number | null;
  probability?: number | null;
  wonValue?: number | null;
}): number {
  if (deal.wonValue != null && deal.wonValue > 0) return deal.wonValue;
  const expected = deal.expectedValue ?? 0;
  if (expected <= 0) return 0;
  const p = deal.probability;
  if (p == null || p <= 0) return expected;
  return (expected * Math.min(p, 100)) / 100;
}
