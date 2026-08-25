/**
 * De vaste stappen van MATO's opvolgritme.
 *
 * Puur, zonder Prisma of "server-only" — zelfde reden als `team-stats.ts` en
 * `claims.ts`: dit is logica die met een test vastligt. De Prisma-kant
 * (inschrijven, annuleren) staat in `cadence-actions.ts`, precies zoals
 * `claims.ts` de filters levert en `actions.ts` de schrijfacties. Eén bestand
 * voor beide zou dit onbedoeld ontestbaar maken — dat is exact wat er met
 * `tasks.ts` gebeurde voor die scheiding er kwam.
 */

export type CadenceKey =
  | "LEAD_FOLLOWUP"
  | "CUSTOMER_ONBOARDING"
  | "INSTALL_HANDOFF"
  | "SHOP_RENEWAL";

export type CadenceStepDef = {
  step: number;
  afterDays: number;
  title: string;
};

/**
 * Dagoffsets zijn een voorstel, geen wet — één array in één bestand, makkelijk
 * bij te stellen zonder ergens anders iets te moeten aanpassen.
 */
export const CADENCES: Record<CadenceKey, CadenceStepDef[]> = {
  LEAD_FOLLOWUP: [
    { step: 1, afterDays: 5, title: "Opvolgen — geen reactie op eerste mail" },
    { step: 2, afterDays: 14, title: "Laatste poging voor je deze zaak loslaat" },
  ],
  CUSTOMER_ONBOARDING: [
    { step: 1, afterDays: 7, title: "Nazorg — eerste week: alles naar wens?" },
    { step: 2, afterDays: 30, title: "Check-in na een maand" },
    { step: 3, afterDays: 90, title: "Kwartaalcheck — vervolgkans?" },
  ],
  INSTALL_HANDOFF: [
    { step: 1, afterDays: 0, title: "Bestelling en leveringsgegevens controleren" },
    { step: 2, afterDays: 3, title: "Installatie met klant bevestigen" },
    { step: 3, afterDays: 7, title: "Opstart en eerste gebruik opvolgen" },
  ],
  SHOP_RENEWAL: [
    { step: 1, afterDays: 0, title: "Shopcontract: verlenging bespreken" },
  ],
};

/** UTC, om dezelfde reden als de daggrens in `tasks.ts`: geen server-tijdzone-afhankelijkheid. */
export function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export type CadenceStep = {
  step: number;
  dueAt: Date;
  title: string;
};

/** Zet één cadans om in concrete stappen met een echte vervaldatum, vanaf `startAt`. */
export function stepsFor(key: CadenceKey, startAt: Date = new Date()): CadenceStep[] {
  return CADENCES[key].map((def) => ({
    step: def.step,
    dueAt: addDays(startAt, def.afterDays),
    title: def.title,
  }));
}
