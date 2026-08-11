/**
 * De rekenregels achter de aanmeldbegrenzing, los van database en request.
 *
 * Apart gehouden omdat dit de kant is die stil fout kan gaan: één `>` in plaats
 * van `>=` scheelt een poging, en een omgedraaide vergelijking zet de deur juist
 * open. Zo is het te testen zonder server.
 */

/** Binnen dit venster wordt geteld. */
export const WINDOW_MINUTES = 15;

/** Per e-mailadres streng: beschermt één account tegen gericht raden. */
export const MAX_PER_EMAIL = 5;

/**
 * Per IP ruimer, want een winkel of kantoor deelt één adres — vijf zou
 * betekenen dat één vergeetachtige collega iedereen buitensluit. Dit vangt de
 * andere vorm: één bron die veel verschillende adressen afgaat.
 */
export const MAX_PER_IP = 20;

/** Hoe lang de blokkade duurt nadat de grens bereikt is. */
export const LOCKOUT_MINUTES = 15;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number };

/**
 * Beslist of er nog een poging bij mag, gegeven het aantal recente mislukkingen.
 *
 * De grens is bereikt *op* het maximum, niet erna: bij vijf mislukte pogingen is
 * de zesde geblokkeerd.
 */
export function evaluateLoginRate(
  failuresByEmail: number,
  failuresByIp: number
): RateLimitResult {
  if (failuresByEmail >= MAX_PER_EMAIL || failuresByIp >= MAX_PER_IP) {
    return { allowed: false, retryAfterMinutes: LOCKOUT_MINUTES };
  }
  return { allowed: true };
}

/** Het begin van het telvenster, gerekend vanaf nu. */
export function windowStart(now: Date = new Date()) {
  return new Date(now.getTime() - WINDOW_MINUTES * 60_000);
}
