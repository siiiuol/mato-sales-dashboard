import { decryptSecret, encryptSecret, SecretError } from "./secrets";

const ENCRYPTED_PREFIX = "v1.";

/**
 * Leest zowel nieuwe versleutelde instellingen als bestaande platte waarden.
 * Daardoor kan de toepassing eerst uitgerold worden en de eenmalige migratie
 * daarna veilig draaien.
 */
export function readSettingSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;
  try {
    return decryptSecret(stored);
  } catch (err) {
    if (err instanceof SecretError) {
      throw new SecretError(
        "Dit bewaarde geheim is niet meer leesbaar. Vul het opnieuw in bij Instellingen."
      );
    }
    throw err;
  }
}

/** Versleutelt een nieuw geheim en voorkomt dubbel versleutelen. */
export function storeSettingSecret(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return value;
  return value.startsWith(ENCRYPTED_PREFIX) ? value : encryptSecret(value);
}

export function hasSettingSecret(stored: string | null | undefined): boolean {
  return Boolean(stored);
}
