/**
 * Hoe een geheim veld uit een formulier gelezen hoort te worden.
 *
 * Een wachtwoordveld toont het bewaarde geheim niet — dat hoort niet in de
 * paginabron te staan. Gevolg: het veld is bij elke volgende opslag leeg. Wie
 * dat leest als "wissen", gooit de sleutel weg zodra iemand de bedrijfsnaam
 * aanpast, en dan staat de koppeling stuk zonder dat er iets veranderd is.
 *
 * Dus: leeg betekent laten staan. Wissen gebeurt alleen als er expliciet om
 * gevraagd wordt, met een aankruisvakje ernaast.
 */

/** `undefined` betekent: dit veld niet meeschrijven. */
export function nextSecretValue(input: {
  /** De ingezonden waarde, of `null` als het veld niet op dit formulier stond. */
  submitted: string | null;
  clear?: boolean;
}): string | undefined {
  if (input.clear) return "";
  if (input.submitted === null) return undefined;
  const trimmed = input.submitted.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Idem voor gewone velden: staat het veld niet op het formulier, schrijf het
 * dan niet. Zo kan een deelformulier bestaan zonder de rest leeg te maken.
 */
export function nextPlainValue(submitted: string | null): string | undefined {
  return submitted === null ? undefined : submitted.trim();
}

/** Laat alleen de sleutels staan die een waarde hebben. */
export function definedOnly<T extends Record<string, unknown>>(
  fields: T
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };
}
