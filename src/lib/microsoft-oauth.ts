import { createHash, randomBytes } from "node:crypto";

/**
 * De OAuth-dans met Microsoft Entra, zonder de netwerk- en databasekant.
 *
 * Apart gehouden zodat de delen die stil fout kunnen gaan te testen zijn: het
 * opbouwen van de autorisatie-URL, de PKCE-berekening en het beoordelen of een
 * token nog geldig is. Een fout daarin geeft geen crash maar een koppeling die
 * "werkt" tot ze op een onhandig moment niet meer werkt.
 */

/**
 * Wat de app aan de mailbox mag doen.
 *
 * `offline_access` levert het refresh token — zonder dat moet iedereen elk uur
 * opnieuw koppelen. `Mail.ReadWrite` is er voor het opzoeken van antwoorden;
 * `Mail.Send` alleen zou versturen wel toelaten maar terugkoppelen niet.
 */
export const MS_SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.Send",
  "Mail.ReadWrite",
] as const;

export type PkcePair = { verifier: string; challenge: string };

/**
 * PKCE: een geheim dat alleen deze browser kent.
 *
 * Ook met een client secret de moeite waard — het bindt de teruggekregen code
 * aan het verzoek dat hem aanvroeg, zodat een onderschepte code in andermans
 * handen waardeloos is.
 */
export function createPkce(): PkcePair {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Willekeurige waarde tegen cross-site request forgery op de terugweg. */
export function createState(): string {
  return randomBytes(24).toString("base64url");
}

export function authorizeUrl({
  tenantId,
  clientId,
  redirectUri,
  state,
  challenge,
  loginHint,
}: {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  loginHint?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: MS_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // Dwingt het keuzescherm af. Zonder dit pakt Microsoft stilzwijgend het
    // account dat in de browser al aangemeld is, en koppelt een medewerker per
    // ongeluk de mailbox van iemand anders.
    prompt: "select_account",
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(
    tenantId
  )}/oauth2/v2.0/authorize?${params.toString()}`;
}

export function tokenUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(
    tenantId
  )}/oauth2/v2.0/token`;
}

/**
 * Marge waarmee een token als verlopen geldt.
 *
 * Een token dat over tien seconden verloopt is voor een aanvraag die nu vertrekt
 * praktisch al verlopen — netwerk, wachtrij en verwerking zitten ertussen.
 */
export const EXPIRY_MARGIN_MS = 120_000;

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() - EXPIRY_MARGIN_MS <= now.getTime();
}

/** Wanneer een token dat `expiresIn` seconden meegaat, verloopt. */
export function expiryFrom(expiresIn: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + expiresIn * 1000);
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

/**
 * Leest het antwoord van de tokendienst.
 *
 * Streng, want een half gelezen antwoord levert een koppeling op die er goed
 * uitziet en pas bij het eerste echte gebruik faalt.
 */
export function parseTokenResponse(raw: unknown): TokenResponse {
  const record = raw as Record<string, unknown>;
  const accessToken = record.access_token;
  const expiresIn = record.expires_in;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Microsoft gaf geen toegangstoken terug.");
  }
  if (typeof expiresIn !== "number" || expiresIn <= 0) {
    throw new Error("Microsoft gaf geen geldige geldigheidsduur terug.");
  }

  return {
    access_token: accessToken,
    refresh_token:
      typeof record.refresh_token === "string" ? record.refresh_token : undefined,
    expires_in: expiresIn,
    scope: typeof record.scope === "string" ? record.scope : undefined,
  };
}

/**
 * Controleert of alle rechten zijn toegekend die we nodig hebben.
 *
 * Een beheerder kan bij het toestemming geven rechten weglaten. Dan lukt het
 * koppelen wél en faalt pas het versturen — beter meteen zeggen wat ontbreekt.
 */
export function missingScopes(granted: string): string[] {
  const have = new Set(granted.toLowerCase().split(/\s+/).filter(Boolean));
  // Alleen de rechten die de app echt gebruikt; de openid-set komt niet altijd
  // terug in `scope` en zegt niets over wat we mogen.
  return ["mail.send", "mail.readwrite"]
    .filter((scope) => !have.has(scope))
    .map((scope) => (scope === "mail.send" ? "Mail.Send" : "Mail.ReadWrite"));
}
