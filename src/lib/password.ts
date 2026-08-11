import { randomInt } from "node:crypto";

/**
 * Wachtwoorden voor nieuwe medewerkersaccounts.
 *
 * Staat apart van `employee-actions.ts`: dat bestand is `"use server"`, en
 * daaruit mag alleen async geëxporteerd worden — een synchrone hulpfunctie
 * breekt de build van de hele module.
 */

/**
 * Zonder l, I, O, 0 en 1: deze wachtwoorden worden mondeling of op papier
 * doorgegeven, en juist die tekens worden dan verkeerd overgenomen.
 */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PASSWORD_LENGTH = 18;

export function generatePassword(length = PASSWORD_LENGTH): string {
  let out = "";
  // randomInt is onvertekend. `randomBytes(n) % alfabetlengte` zou de eerste
  // tekens van het alfabet vaker opleveren dan de laatste, omdat 256 geen
  // veelvoud is van 57.
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
