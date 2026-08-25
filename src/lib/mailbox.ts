import "server-only";

import { prisma } from "./db";
import { decryptSecret, encryptSecret, SecretError } from "./secrets";
import { readSettingSecret } from "./settings-secrets";
import {
  expiryFrom,
  isExpired,
  missingScopes,
  MS_SCOPES,
  parseTokenResponse,
  tokenUrl,
} from "./microsoft-oauth";

/**
 * De gekoppelde mailbox van een medewerker: opslaan, verversen, opvragen.
 *
 * Tokens gaan versleuteld de database in. Een refresh token blijft maanden
 * geldig en geeft toegang tot een volledig postvak — dat hoort niet leesbaar in
 * een tabel te staan waar een back-up of een export bij kan.
 */

export class MailboxError extends Error {}
/** Tokens in de database zijn niet meer te lezen; de koppeling moet opnieuw. */
export class MailboxSecretError extends MailboxError {}

export type MsConfig = {
  clientId: string;
  tenantId: string;
  clientSecret: string;
};

/** Haalt de Entra-instellingen op en ontcijfert het geheim. */
export async function msConfig(): Promise<MsConfig> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  const clientId = settings?.msClientId?.trim() ?? "";
  const tenantId = settings?.msTenantId?.trim() ?? "";
  const stored = settings?.msClientSecret ?? "";

  if (!clientId || !tenantId || !stored) {
    throw new MailboxError(
      "De Microsoft-koppeling is nog niet ingesteld. Vul client-id, tenant-id en het geheim in bij Instellingen."
    );
  }
  try {
    const clientSecret = readSettingSecret(stored);
    if (!clientSecret) {
      throw new MailboxError(
        "De Microsoft-koppeling is nog niet ingesteld. Vul client-id, tenant-id en het geheim in bij Instellingen."
      );
    }
    return { clientId, tenantId, clientSecret };
  } catch (err) {
    if (err instanceof SecretError) {
      throw new MailboxError(
        "Het Microsoft-clientgeheim is niet meer leesbaar. Vul het opnieuw in bij Instellingen en koppel daarna de mailbox."
      );
    }
    throw err;
  }
}

function decryptMailboxToken(stored: string): string {
  try {
    return decryptSecret(stored);
  } catch (err) {
    if (err instanceof SecretError) {
      throw new MailboxSecretError(
        "De mailboxkoppeling is niet meer leesbaar. Koppel de mailbox opnieuw bij Instellingen."
      );
    }
    throw err;
  }
}

/**
 * Wisselt een autorisatiecode of een refresh token in voor nieuwe tokens.
 *
 * Eén functie voor beide, omdat het dezelfde aanroep is met een ander
 * `grant_type` — ze uit elkaar trekken levert twee plekken op die uit de pas
 * kunnen lopen.
 */
async function requestTokens(
  config: MsConfig,
  grant: Record<string, string>
): Promise<{ access: string; refresh?: string; expiresAt: Date; scope: string }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: MS_SCOPES.join(" "),
    ...grant,
  });

  let response: Response;
  try {
    response = await fetch(tokenUrl(config.tenantId), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MailboxError("Microsoft is niet bereikbaar.");
  }

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    // De omschrijving van Microsoft is hier bruikbaarder dan wat wij kunnen
    // raden — die noemt bijvoorbeeld een verkeerde redirect-URI met naam.
    const description =
      typeof raw.error_description === "string"
        ? raw.error_description.split("\n")[0]
        : typeof raw.error === "string"
          ? raw.error
          : "onbekende fout";
    throw new MailboxError(`Microsoft weigerde de aanvraag: ${description}`);
  }

  const parsed = parseTokenResponse(raw);
  return {
    access: parsed.access_token,
    refresh: parsed.refresh_token,
    expiresAt: expiryFrom(parsed.expires_in),
    scope: parsed.scope ?? "",
  };
}

/** Het adres van de mailbox die zojuist gekoppeld is. */
async function fetchMailboxAddress(accessToken: string): Promise<string> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new MailboxError("Kon het mailadres niet ophalen bij Microsoft.");
  }
  const profile = (await response.json()) as {
    mail?: string;
    userPrincipalName?: string;
  };
  const address = profile.mail || profile.userPrincipalName;
  if (!address) throw new MailboxError("Dit account heeft geen mailadres.");
  return address;
}

/**
 * Rondt het koppelen af en bewaart de tokens.
 *
 * Ontbrekende rechten worden hier al geweigerd. Anders lukt het koppelen, ziet
 * de medewerker "verbonden" staan, en faalt pas de eerste echte mail.
 */
export async function completeConnection({
  userId,
  code,
  verifier,
  redirectUri,
}: {
  userId: string;
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<string> {
  const config = await msConfig();
  const tokens = await requestTokens(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const missing = missingScopes(tokens.scope);
  if (missing.length) {
    throw new MailboxError(
      `Deze rechten zijn niet toegekend: ${missing.join(", ")}. Vraag de beheerder om toestemming te verlenen in Entra.`
    );
  }
  if (!tokens.refresh) {
    throw new MailboxError(
      "Microsoft gaf geen refresh token. Controleer of offline_access is toegestaan."
    );
  }

  const address = await fetchMailboxAddress(tokens.access);

  await prisma.mailboxConnection.upsert({
    where: { userId },
    update: {
      emailAddress: address,
      accessToken: encryptSecret(tokens.access),
      refreshToken: encryptSecret(tokens.refresh),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
    create: {
      userId,
      emailAddress: address,
      accessToken: encryptSecret(tokens.access),
      refreshToken: encryptSecret(tokens.refresh),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    },
  });

  return address;
}

/**
 * Een bruikbaar toegangstoken, desnoods ververst.
 *
 * Elke aanroep naar Graph gaat hier langs, zodat er nergens anders over
 * geldigheid nagedacht hoeft te worden.
 */
export async function accessTokenFor(userId: string): Promise<string> {
  const connection = await prisma.mailboxConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new MailboxError(
      "Je mailbox is nog niet gekoppeld. Doe dat bij Instellingen."
    );
  }

  try {
    if (!isExpired(connection.expiresAt)) {
      return decryptMailboxToken(connection.accessToken);
    }

    const config = await msConfig();
    const tokens = await requestTokens(config, {
      grant_type: "refresh_token",
      refresh_token: decryptMailboxToken(connection.refreshToken),
    });

    await prisma.mailboxConnection.update({
      where: { userId },
      data: {
        accessToken: encryptSecret(tokens.access),
        // Microsoft stuurt niet altijd een nieuw refresh token; het oude blijft
        // dan geldig. Overschrijven met leeg zou de koppeling verbreken.
        ...(tokens.refresh ? { refreshToken: encryptSecret(tokens.refresh) } : {}),
        expiresAt: tokens.expiresAt,
      },
    });

    return tokens.access;
  } catch (err) {
    if (err instanceof MailboxSecretError) {
      await prisma.mailboxConnection.deleteMany({ where: { userId } });
    }
    throw err;
  }
}

export async function disconnectMailbox(userId: string) {
  await prisma.mailboxConnection.deleteMany({ where: { userId } });
}
