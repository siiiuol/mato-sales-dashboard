"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import {
  CONTACT_CONSENT,
  CONTACT_INFLUENCE,
  CONTACT_ROLES,
} from "./constants";

/**
 * Contactpersonen op een klant.
 *
 * Dit is een ander ding dan `contact-log.ts` — dat logt uitgaand contact met
 * een lead naar `OutreachEvent`. Dit hier is het personeel bij de klant: wie
 * beslist, wie je moet hebben, hoe je die persoon best bereikt.
 */

const contactSchema = z.object({
  customerId: idSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  role: z.enum(CONTACT_ROLES),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  mobile: z.string().trim().max(30).optional().or(z.literal("")),
  decisionMaker: z.string().optional(),
  influence: z.enum(CONTACT_INFLUENCE),
  consent: z.enum(CONTACT_CONSENT),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ContactFormState = {
  error?: string;
  /** Verandert bij elke geslaagde opslag, zodat het formulier zich leegmaakt. */
  savedId?: string;
};

export async function createContact(
  _previous: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const user = await requireUser(["admin", "sales"]);
  const parsed = contactSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Controleer de gegevens" };
  }
  const input = parsed.data;

  const contact = await prisma.contact.create({
    data: {
      customerId: input.customerId,
      firstName: input.firstName,
      lastName: input.lastName || null,
      jobTitle: input.jobTitle || null,
      role: input.role,
      email: input.email || null,
      phone: input.phone || null,
      mobile: input.mobile || null,
      decisionMaker: input.decisionMaker === "on",
      influence: input.influence,
      consent: input.consent,
      notes: input.notes || null,
      ownerId: user.id,
    },
  });

  await audit(user.id, "contact.created", "contact", contact.id, {
    customerId: input.customerId,
    naam: `${input.firstName} ${input.lastName}`.trim(),
  });
  revalidatePath(`/klanten/${input.customerId}`);
  return { savedId: contact.id };
}

const updateSchema = contactSchema.extend({ contactId: idSchema });

export async function updateContact(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = updateSchema.parse(formObject(formData));

  await prisma.contact.update({
    where: { id: input.contactId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName || null,
      jobTitle: input.jobTitle || null,
      role: input.role,
      email: input.email || null,
      phone: input.phone || null,
      mobile: input.mobile || null,
      decisionMaker: input.decisionMaker === "on",
      influence: input.influence,
      consent: input.consent,
      notes: input.notes || null,
    },
  });

  await audit(user.id, "contact.updated", "contact", input.contactId, {
    customerId: input.customerId,
  });
  revalidatePath(`/klanten/${input.customerId}`);
}

export async function deleteContact(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ contactId: idSchema, customerId: idSchema })
    .parse(formObject(formData));

  await prisma.contact.delete({ where: { id: input.contactId } });
  await audit(user.id, "contact.deleted", "contact", input.contactId, {
    customerId: input.customerId,
  });
  revalidatePath(`/klanten/${input.customerId}`);
}
