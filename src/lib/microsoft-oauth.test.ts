import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  authorizeUrl,
  createPkce,
  createState,
  EXPIRY_MARGIN_MS,
  expiryFrom,
  isExpired,
  missingScopes,
  MS_SCOPES,
  parseTokenResponse,
} from "./microsoft-oauth";

const TENANT = "afde93d1-87e5-4c45-a8d1-9a27172764a5";
const CLIENT = "d7aee553-d2f1-4bba-be74-0ee359c07350";
const REDIRECT = "http://localhost:3000/api/mail/callback";

test("the PKCE challenge is the SHA-256 of the verifier", () => {
  // Rekent Microsoft ook uit; komt het niet overeen, dan faalt het inwisselen
  // van de code met een nietszeggende fout.
  const { verifier, challenge } = createPkce();
  assert.equal(createHash("sha256").update(verifier).digest("base64url"), challenge);
});

test("every PKCE pair and state is different", () => {
  const pairs = new Set(Array.from({ length: 25 }, () => createPkce().verifier));
  assert.equal(pairs.size, 25);
  const states = new Set(Array.from({ length: 25 }, () => createState()));
  assert.equal(states.size, 25);
});

test("PKCE and state are URL-safe", () => {
  // base64url, geen +/= — anders breken ze in een querystring.
  for (let i = 0; i < 10; i++) {
    assert.match(createPkce().verifier, /^[A-Za-z0-9_-]+$/);
    assert.match(createState(), /^[A-Za-z0-9_-]+$/);
  }
});

test("the authorize URL carries the tenant, client, redirect and challenge", () => {
  const url = new URL(
    authorizeUrl({
      tenantId: TENANT,
      clientId: CLIENT,
      redirectUri: REDIRECT,
      state: "st",
      challenge: "ch",
    })
  );
  assert.ok(url.pathname.includes(TENANT));
  assert.equal(url.searchParams.get("client_id"), CLIENT);
  assert.equal(url.searchParams.get("redirect_uri"), REDIRECT);
  assert.equal(url.searchParams.get("state"), "st");
  assert.equal(url.searchParams.get("code_challenge"), "ch");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("response_type"), "code");
});

test("offline_access is requested, or nobody stays connected", () => {
  const url = new URL(
    authorizeUrl({
      tenantId: TENANT,
      clientId: CLIENT,
      redirectUri: REDIRECT,
      state: "s",
      challenge: "c",
    })
  );
  const scope = url.searchParams.get("scope") ?? "";
  assert.ok(scope.includes("offline_access"));
  assert.ok(scope.includes("Mail.Send"));
  assert.ok(scope.includes("Mail.ReadWrite"));
});

test("the account picker is always forced", () => {
  // Anders pakt Microsoft stilzwijgend het account dat al in de browser zit en
  // koppelt iemand de mailbox van een collega.
  const url = new URL(
    authorizeUrl({
      tenantId: TENANT,
      clientId: CLIENT,
      redirectUri: REDIRECT,
      state: "s",
      challenge: "c",
    })
  );
  assert.equal(url.searchParams.get("prompt"), "select_account");
});

test("a token about to expire counts as expired", () => {
  // Netwerk en wachtrij zitten tussen "nu" en het echte gebruik.
  const now = new Date("2026-08-12T12:00:00Z");
  const almost = new Date(now.getTime() + EXPIRY_MARGIN_MS - 1000);
  assert.equal(isExpired(almost, now), true);
});

test("a token with plenty of life left is not expired", () => {
  const now = new Date("2026-08-12T12:00:00Z");
  const later = new Date(now.getTime() + 30 * 60_000);
  assert.equal(isExpired(later, now), false);
});

test("expiry is computed from seconds, not milliseconds", () => {
  const now = new Date("2026-08-12T12:00:00Z");
  assert.equal(expiryFrom(3600, now).toISOString(), "2026-08-12T13:00:00.000Z");
});

test("a token response without an access token is refused", () => {
  assert.throws(() => parseTokenResponse({ expires_in: 3600 }), /toegangstoken/);
});

test("a token response without a usable lifetime is refused", () => {
  assert.throws(() => parseTokenResponse({ access_token: "x" }), /geldigheidsduur/);
  assert.throws(
    () => parseTokenResponse({ access_token: "x", expires_in: 0 }),
    /geldigheidsduur/
  );
});

test("a refresh response without a new refresh token is still valid", () => {
  // Microsoft stuurt niet altijd een nieuw refresh token mee; de oude blijft
  // dan geldig. Dit als fout behandelen zou de koppeling onnodig verbreken.
  const parsed = parseTokenResponse({ access_token: "a", expires_in: 3600 });
  assert.equal(parsed.refresh_token, undefined);
  assert.equal(parsed.access_token, "a");
});

test("missing permissions are named, not just counted", () => {
  // Een beheerder kan bij het toestemmen rechten weglaten; dan lukt koppelen
  // wel en faalt pas het versturen.
  assert.deepEqual(missingScopes("openid profile Mail.Send"), ["Mail.ReadWrite"]);
  assert.deepEqual(missingScopes("Mail.Send Mail.ReadWrite"), []);
  assert.deepEqual(missingScopes(""), ["Mail.Send", "Mail.ReadWrite"]);
});

test("permission matching ignores case", () => {
  assert.deepEqual(missingScopes("mail.send MAIL.READWRITE"), []);
});

test("the scope list has no duplicates", () => {
  assert.equal(new Set(MS_SCOPES).size, MS_SCOPES.length);
});
