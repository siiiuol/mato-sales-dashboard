/**
 * Zachte claims: voorkomen dat twee medewerkers dezelfde zaak bellen.
 *
 * Twee mechanismen, want elk apart lekt:
 *
 * 1. **Claimen bij tonen.** Wie een lead in Werk voor zich krijgt, claimt hem.
 *    De wachtrij van een collega laat geclaimde leads weg.
 * 2. **Vrijgeven bij noteren.** Zodra het gesprek genoteerd is verandert de
 *    status en valt de lead sowieso uit elke wachtrij.
 *
 * Zonder (1) zien twee mensen die tegelijk beginnen dezelfde bovenste lead.
 * Zonder (2) zou een lead na afloop geclaimd blijven staan.
 *
 * De claim vervalt vanzelf. Een browser die dichtgeklapt wordt mag geen zaak
 * gijzelen tot iemand het handmatig losmaakt.
 */

/** Hoe lang een claim geldig blijft zonder dat er iets mee gebeurt. */
export const CLAIM_TTL_MINUTES = 30;

/** Claims van vóór dit moment zijn vervallen en tellen niet meer mee. */
export function staleClaimCutoff(now: Date = new Date()) {
  return new Date(now.getTime() - CLAIM_TTL_MINUTES * 60_000);
}

/**
 * Prisma-filter voor "leads waar ik aan mag werken".
 *
 * Bedoeld om in een `AND` te zetten, niet om in een bestaande `where` te
 * spreiden: verschillende wachtrijen hebben zelf al een `OR` (op `nextActionAt`)
 * en die zou er dan stilletjes door overschreven worden.
 */
export function claimFilter(userId: string, now: Date = new Date()) {
  return {
    OR: [
      { claimedById: null },
      { claimedById: userId },
      { claimedAt: { lt: staleClaimCutoff(now) } },
    ],
  };
}

/**
 * Voorwaarde waaronder een claim overgenomen mag worden.
 *
 * Gebruikt in een `updateMany`: die schrijft alleen als de rij nog aan de
 * voorwaarde voldoet, dus twee gelijktijdige pogingen kunnen niet allebei
 * slagen. `count === 1` is het bewijs dat de claim van jou is.
 */
export function claimableWhere(leadId: string, userId: string, now: Date = new Date()) {
  return {
    id: leadId,
    ...claimFilter(userId, now),
  };
}
