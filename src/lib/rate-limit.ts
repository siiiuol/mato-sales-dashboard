import "server-only";

import { headers } from "next/headers";
import { prisma } from "./db";
import {
  evaluateLoginRate,
  windowStart,
  type RateLimitResult,
} from "./rate-limit-policy";

/**
 * Aanmeldbegrenzing tegen het raden van wachtwoorden.
 *
 * De tellers staan in de database en niet in het geheugen. Op Vercel draait
 * elke aanvraag in een eigen instantie met eigen geheugen, dus een teller in een
 * module-variabele begrenst daar niets — die ziet telkens maar een fractie van
 * de pogingen.
 *
 * De drempels zelf staan in `rate-limit-policy.ts`, waar ze getest worden.
 */

export type { RateLimitResult };

/**
 * Het IP van de bezoeker, zoals de proxy het doorgeeft.
 *
 * `x-forwarded-for` is een lijst waarvan alleen het eerste adres van de client
 * komt; de rest is onderweg toegevoegd. Achter Vercel is `x-real-ip` gezet en
 * betrouwbaarder.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return null;
}

/**
 * Mag er nu een aanmeldpoging voor dit adres gedaan worden?
 *
 * Telt alleen mislukte pogingen: een geslaagde aanmelding hoort niemand dichter
 * bij een blokkade te brengen.
 */
export async function checkLoginRate(
  email: string,
  ip: string | null
): Promise<RateLimitResult> {
  const since = windowStart();

  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: since } },
    }),
    ip
      ? prisma.loginAttempt.count({
          where: { ip, success: false, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  return evaluateLoginRate(byEmail, byIp);
}

export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  success: boolean
) {
  await prisma.loginAttempt.create({ data: { email, ip, success } });
}

/**
 * Ruimt pogingen ouder dan een dag op.
 *
 * Lift mee op een geslaagde aanmelding in plaats van een aparte taak — de tabel
 * groeit alleen bij aanmeldverkeer, dus daar hoort het opruimen ook.
 */
export async function pruneLoginAttempts() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
