import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Eerste laag: koppen die de browser instrueren, en een vroege afwijzing van
 * verzoeken zonder sessiecookie.
 *
 * De echte afscherming blijft `requirePageUser` / `requireUser` op de pagina's
 * en acties zelf. Hier wordt alleen gekeken óf er een cookie is, niet of die
 * deugt — dat kan hier ook niet: middleware draait op de Edge-runtime zonder
 * database, dus rol en sessionVersion zijn niet te controleren. Wie dit als het
 * slot beschouwt, laat een vervalste cookie door.
 */

/** Paden die zonder sessie bereikbaar moeten blijven. */
const PUBLIC = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC.some((path) => pathname.startsWith(path));
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Alleen in productie. De ontwikkelserver leunt voor hot reload zwaar op
  // inline scripts en eval; een streng beleid legt dat stil, en het beschermt
  // dan een server die alleen op deze machine bereikbaar is.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  /**
   * Per aanvraag een nonce. Next leest die uit de CSP in de *request*-koppen en
   * zet hem op zijn eigen scripttags, waardoor `'unsafe-inline'` overbodig
   * wordt — en dat is precies de opening waarlangs een injectie schade doet.
   *
   * Kost wel de statische optimalisatie, maar elke pagina hier staat al op
   * `force-dynamic` omdat ze allemaal uit de database lezen.
   */
  const nonce = crypto.randomUUID().replaceAll("-", "");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Inline styles blijven toegestaan: Next zet zijn stijlen inline en de app
    // gebruikt style-attributen. Styles zijn een veel smallere aanvalsweg.
    "style-src 'self' 'unsafe-inline'",
    // Kaarttegels van CartoDB, attributie van OpenStreetMap.
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  return response;
}

export const config = {
  /**
   * Statische bestanden overslaan: die hebben geen sessie nodig en zouden
   * anders bij elke aanvraag door deze controle gaan.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)",
  ],
};
