import "server-only";

import { cookies } from "next/headers";
import { decryptSecret, encryptSecret } from "./secrets";

/**
 * De kortlevende cookie die een koppelpoging bij elkaar houdt.
 *
 * Bevat de state (tegen een vervalste terugweg) en de PKCE-verifier. Op de
 * server bewaren zou een tabel vragen die na elke afgebroken poging blijft
 * rondslingeren; in een HttpOnly-cookie horen ze bij de browser die de poging
 * begon, en dat is precies de binding die nodig is.
 *
 * Versleuteld, zodat de verifier niet leesbaar is voor wie de cookie te pakken
 * krijgt.
 */

export const OAUTH_COOKIE = "mato_ms_oauth";

/** Vijf minuten: ruim voor een aanmeldscherm, kort genoeg om te vervallen. */
const MAX_AGE = 300;

/**
 * `userId` hoort er nadrukkelijk bij.
 *
 * De cookie hangt aan de browser, niet aan het account. Op een gedeelde laptop
 * kan de ene medewerker de koppeling starten, de andere zich intussen aanmelden,
 * en dan zou het postvak van de eerste onder het account van de tweede belanden
 * — met zijn mail en zijn antwoorden. Door wie hem startte mee te versleutelen
 * kan de terugweg dat zien en weigeren.
 */
export type OauthAttempt = { state: string; verifier: string; userId: string };

export function serialiseAttempt(attempt: OauthAttempt): string {
  return encryptSecret(JSON.stringify(attempt));
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
    // Beperkt tot de koppelroutes; de cookie hoort nergens anders mee te reizen.
    path: "/api/mail",
  };
}

/**
 * Leest de poging uit de cookie.
 *
 * Geeft `null` bij alles wat niet klopt — ontbrekend, onleesbaar, of van de
 * verkeerde vorm. De aanroeper behandelt die gevallen identiek: opnieuw
 * beginnen.
 */
export async function readAttempt(): Promise<OauthAttempt | null> {
  const raw = (await cookies()).get(OAUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decryptSecret(raw)) as Partial<OauthAttempt>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.verifier !== "string" ||
      typeof parsed.userId !== "string"
    ) {
      return null;
    }
    if (!parsed.state || !parsed.verifier || !parsed.userId) return null;
    return { state: parsed.state, verifier: parsed.verifier, userId: parsed.userId };
  } catch {
    return null;
  }
}
