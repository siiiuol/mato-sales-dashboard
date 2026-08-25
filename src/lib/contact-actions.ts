"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "./dal";
import { logContactForLead, type ContactType } from "./contact-log";
import { formObject, idSchema } from "./validation";

const contactTypeSchema = z.enum(["CALL", "EMAIL", "VISIT", "NOTE"]);
const contactOutcomeSchema = z
  .enum([
    "NO_ANSWER",
    "VOICEMAIL",
    "WRONG_NUMBER",
    "INTERESTED",
    "NOT_INTERESTED",
    "CALLBACK",
    "OTHER",
    "SENT",
    "NO_REPLY",
    "",
  ])
  .optional();

export type ContactLogState = {
  error?: string;
  ok?: boolean;
  /**
   * Id van het zojuist genoteerde contact.
   *
   * Dient als sleutel voor het formulier: een nieuwe waarde laat React het
   * opnieuw opbouwen, waarmee de velden leeg zijn en het soort terugvalt op
   * "gebeld". Dat is de reden dat dit een id is en geen `true` — bij twee keer
   * hetzelfde noteren moet de waarde tóch veranderen.
   */
  savedId?: string;
};

/**
 * Noteert een contact op de bedrijfsfiche.
 *
 * Verstuurt niets — alleen opslaan in de geschiedenis, zodat elk bedrijf
 * traceerbaar blijft.
 */
export async function logContact(
  _previous: ContactLogState,
  formData: FormData
): Promise<ContactLogState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const parsed = z
      .object({
        leadId: idSchema,
        type: contactTypeSchema,
        outcome: contactOutcomeSchema,
        note: z.string().trim().max(2000).optional(),
        callbackAt: z.string().optional(),
        lossReason: z
          .enum([
            "NO_INTEREST",
            "TIMING",
            "PRICE",
            "NO_FIT",
            "COMPETITOR",
            "UNREACHABLE",
            "DUPLICATE",
            "OTHER",
          ])
          .optional()
          .or(z.literal("")),
      })
      .parse(formObject(formData));

    const savedId = await logContactForLead({
      leadId: parsed.leadId,
      type: parsed.type as ContactType,
      outcome: parsed.outcome || null,
      note: parsed.note,
      callbackAt: parsed.callbackAt,
      lossReason: parsed.lossReason || null,
      userId: user.id,
    });

    revalidatePath(`/leads/${parsed.leadId}`);
    revalidatePath("/");
    revalidatePath("/leads");
    return { ok: true, savedId };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: "Ongeldige invoer" };
    }
    return {
      error: err instanceof Error ? err.message : "Opslaan is niet gelukt",
    };
  }
}
