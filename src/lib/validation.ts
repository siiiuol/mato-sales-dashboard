import { z } from "zod";

export const idSchema = z.string().cuid();
export const roleSchema = z.enum(["admin", "sales", "reviewer"]);
export const leadStatusSchema = z.enum([
  "NEW",
  "TO_CALL",
  "CONTACTED",
  "FOLLOW_UP",
  "NEGOTIATION",
  "WON",
  "LOST",
  "SKIPPED",
  "DO_NOT_CONTACT",
]);
export const callOutcomeSchema = z.enum([
  "NO_ANSWER",
  "VOICEMAIL",
  "WRONG_NUMBER",
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK",
  "OTHER",
]);



export function formObject(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"))
  );
}
