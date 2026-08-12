import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret, maskSecret, SecretError } from "./secrets";

test("a secret survives a round trip", () => {
  const token = "1//0eXaMpLe-refresh-token_value.with-punctuation";
  assert.equal(decryptSecret(encryptSecret(token)), token);
});

test("the same secret encrypts differently every time", () => {
  // Een vaste IV zou verraden welke twee medewerkers hetzelfde wachtwoord
  // hebben, puur door de opgeslagen waarden naast elkaar te leggen.
  const a = encryptSecret("zelfde-geheim");
  const b = encryptSecret("zelfde-geheim");
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), decryptSecret(b));
});

test("the plaintext never appears in the stored value", () => {
  const stored = encryptSecret("herkenbaar-wachtwoord");
  assert.ok(!stored.includes("herkenbaar"));
});

test("an empty value stays empty rather than encrypting nothing", () => {
  assert.equal(encryptSecret(""), "");
  assert.equal(decryptSecret(""), "");
});

test("tampering with the ciphertext is detected, not decoded to nonsense", () => {
  // Dit is waarom er GCM gebruikt wordt en geen CBC: een gewijzigde waarde
  // hoort een fout te geven, geen half plausibel token.
  const stored = encryptSecret("geheim");
  const parts = stored.split(".");
  const flipped = Buffer.from(parts[3], "base64url");
  flipped[0] ^= 0xff;
  const tampered = [parts[0], parts[1], parts[2], flipped.toString("base64url")].join(".");
  assert.throws(() => decryptSecret(tampered), SecretError);
});

test("a truncated or foreign value is refused", () => {
  assert.throws(() => decryptSecret("gewoon-tekst"), SecretError);
  assert.throws(() => decryptSecret("v1.aa.bb"), SecretError);
  assert.throws(() => decryptSecret("v2.aa.bb.cc"), SecretError);
});

test("unicode and long values round trip intact", () => {
  const value = "wachtwoord-mét-áccenten-en-emoji-🔑-" + "x".repeat(4000);
  assert.equal(decryptSecret(encryptSecret(value)), value);
});

test("masking shows enough to recognise and too little to use", () => {
  const masked = maskSecret("sk-abcdefghijklmnop");
  assert.match(masked, /^sk-a/);
  assert.match(masked, /mnop$/);
  assert.ok(!masked.includes("efghij"));
});

test("a short secret is masked completely", () => {
  assert.equal(maskSecret("kort"), "••••");
});
