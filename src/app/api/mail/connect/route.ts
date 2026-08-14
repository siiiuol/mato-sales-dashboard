import { NextResponse } from "next/server";
import { requireUser } from "@/lib/dal";
import { msConfig, MailboxError } from "@/lib/mailbox";
import { authorizeUrl, createPkce, createState } from "@/lib/microsoft-oauth";
import { SecretError } from "@/lib/secrets";
import {
  cookieOptions,
  OAUTH_COOKIE,
  serialiseAttempt,
} from "@/lib/oauth-cookie";

/** Start het koppelen van de eigen mailbox aan Microsoft 365. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(["admin", "sales"]);
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let config;
  try {
    config = await msConfig();
  } catch (err) {
    // Ook de SecretError doorgeven: die betekent dat SESSION_SECRET veranderd
    // is en het geheim opnieuw ingevuld moet worden. "Niet ingesteld" zou de
    // beheerder naar een veld sturen dat er al ingevuld uitziet.
    const message =
      err instanceof MailboxError || err instanceof SecretError
        ? err.message
        : "De koppeling is niet ingesteld.";
    return NextResponse.redirect(
      new URL(`/settings?mailbox=${encodeURIComponent(message)}`, request.url)
    );
  }

  const origin = new URL(request.url).origin;
  const state = createState();
  const { verifier, challenge } = createPkce();

  const response = NextResponse.redirect(
    authorizeUrl({
      tenantId: config.tenantId,
      clientId: config.clientId,
      redirectUri: `${origin}/api/mail/callback`,
      state,
      challenge,
      // Zet alvast het juiste account voor; het keuzescherm blijft staan.
      loginHint: user.email,
    })
  );

  response.cookies.set(
    OAUTH_COOKIE,
    serialiseAttempt({ state, verifier, userId: user.id }),
    cookieOptions()
  );

  return response;
}
