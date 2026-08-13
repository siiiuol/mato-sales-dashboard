import { NextResponse } from "next/server";
import { audit, requireUser } from "@/lib/dal";
import { completeConnection, MailboxError } from "@/lib/mailbox";
import { OAUTH_COOKIE, readAttempt } from "@/lib/oauth-cookie";

/** De terugweg vanaf Microsoft: code inwisselen en de mailbox opslaan. */
export const dynamic = "force-dynamic";

/** Stuurt terug naar Instellingen met een leesbare uitkomst. */
function back(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  // De poging is voorbij, geslaagd of niet: de cookie mag niet blijven staan om
  // een tweede keer geprobeerd te worden.
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/mail" });
  return response;
}

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(["admin", "sales"]);
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const query = new URL(request.url).searchParams;

  // Microsoft meldt een geweigerde toestemming hier, niet als foutcode.
  const error = query.get("error");
  if (error) {
    const description = query.get("error_description")?.split("\n")[0] ?? error;
    return back(request, { mailbox: `Koppelen afgebroken: ${description}` });
  }

  const code = query.get("code");
  const state = query.get("state");
  const attempt = await readAttempt();

  if (!code || !state || !attempt) {
    return back(request, {
      mailbox: "De koppelpoging is verlopen. Probeer het opnieuw.",
    });
  }

  // De state uit de cookie moet die uit de URL zijn. Zonder deze vergelijking
  // kan iemand een medewerker naar een callback met zijn eigen code lokken en
  // zo zijn mailbox aan het account van die medewerker hangen.
  if (state !== attempt.state) {
    return back(request, {
      mailbox: "De koppeling kon niet geverifieerd worden. Probeer het opnieuw.",
    });
  }

  const origin = new URL(request.url).origin;

  try {
    const address = await completeConnection({
      userId: user.id,
      code,
      verifier: attempt.verifier,
      redirectUri: `${origin}/api/mail/callback`,
    });

    await audit(user.id, "mailbox.connect", "user", user.id, { address });

    return back(request, { mailbox_ok: address });
  } catch (err) {
    const message =
      err instanceof MailboxError
        ? err.message
        : "Koppelen is mislukt. Probeer het opnieuw.";
    return back(request, { mailbox: message });
  }
}
