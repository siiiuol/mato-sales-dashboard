import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Versleutelt langlevende inloggegevens voordat ze de database in gaan.
 *
 * Nodig voor de mailkoppeling: een refresh token blijft maanden geldig en geeft
 * toegang tot een volledige mailbox. Zoiets hoort niet leesbaar in een tabel te
 * staan waar een back-up, een export of een misplaatste query bij kan.
 *
 * AES-256-GCM, dus met een authenticatielabel: een gewijzigde cijfertekst geeft
 * een fout in plaats van onzin. De sleutel komt van `SESSION_SECRET`, die in
 * productie toch al verplicht en willekeurig is.
 *
 * Let op: het draaien van `SESSION_SECRET` maakt bestaande waarden
 * onleesbaar. Dat is voor sessies bedoeld gedrag en hier de juiste afweging —
 * medewerkers koppelen hun mailbox dan opnieuw.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const SALT = "mato-secret-v1";

export class SecretError extends Error {}

function key(): Buffer {
  const secret =
    process.env.SESSION_SECRET ??
    (process.env.NODE_ENV !== "production"
      ? "mato-local-development-session-secret-change-me"
      : undefined);
  if (!secret || secret.length < 32) {
    throw new SecretError("SESSION_SECRET moet minstens 32 tekens lang zijn");
  }
  return scryptSync(secret, SALT, 32);
}

/**
 * Vorm: `v1.<iv>.<tag>.<cijfertekst>`, alles base64url.
 *
 * Het versienummer staat vooraan zodat er later een ander schema naast kan
 * bestaan zonder dat oude waarden onleesbaar worden.
 */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(stored: string): string {
  if (!stored) return "";
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new SecretError("Onbekende vorm van versleutelde waarde");
  }
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key(),
      Buffer.from(parts[1], "base64url")
    );
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    if (err instanceof SecretError) throw err;
    // Kan ook betekenen dat SESSION_SECRET veranderd is; de waarde is in beide
    // gevallen onbruikbaar. De aanroeper zegt wat de gebruiker dan moet doen.
    throw new SecretError("Deze waarde is niet te ontcijferen.");
  }
}

/** Toont genoeg om te herkennen, te weinig om te gebruiken. */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 8) return "•".repeat(plain.length);
  return `${plain.slice(0, 4)}${"•".repeat(8)}${plain.slice(-4)}`;
}
