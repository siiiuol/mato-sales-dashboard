"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { CONTACT_CONSENT, CONTACT_INFLUENCE, CONTACT_ROLES } from "./constants";

const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().transform((v) => v || null);
const optionalId = z.string().cuid().optional().or(z.literal("")).transform((v) => v || null);
const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: optionalText(120),
  jobTitle: optionalText(160),
  department: optionalText(160),
  role: z.enum(CONTACT_ROLES).optional(),
  email: optionalText(320),
  phone: optionalText(50),
  mobile: optionalText(50),
  linkedin: optionalText(2048),
  wechat: optionalText(100),
  whatsapp: optionalText(50),
  language: z.string().trim().max(10).optional(),
  preferredVia: optionalText(40),
  decisionMaker: z.string().optional(),
  influence: z.enum(CONTACT_INFLUENCE).optional(),
  consent: z.enum(CONTACT_CONSENT).optional(),
  nextFollowUp: optionalDate,
  notes: optionalText(5000),
  leadId: optionalId,
  customerId: optionalId,
  supplierId: optionalId,
});

export async function createContact(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = contactSchema.parse(formObject(formData));

  const contact = await prisma.contact.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle,
      department: input.department,
      role: input.role ?? "GENERAL",
      email: input.email,
      phone: input.phone,
      mobile: input.mobile,
      linkedin: input.linkedin,
      wechat: input.wechat,
      whatsapp: input.whatsapp,
      language: input.language || "nl",
      preferredVia: input.preferredVia,
      decisionMaker: input.decisionMaker === "on",
      influence: input.influence ?? "UNKNOWN",
      consent: input.consent ?? "UNKNOWN",
      nextFollowUp: input.nextFollowUp,
      notes: input.notes,
      leadId: input.leadId,
      customerId: input.customerId,
      supplierId: input.supplierId,
      ownerId: user.id,
    },
  });
  await audit(user.id, "contact.created", "contact", contact.id);
  revalidatePath("/contacts");
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  if (input.supplierId) revalidatePath(`/suppliers/${input.supplierId}`);
}

export async function logContactTouch(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ contactId: idSchema, nextFollowUp: optionalDate })
    .parse(formObject(formData));

  await prisma.contact.update({
    where: { id: input.contactId },
    data: { lastContactAt: new Date(), nextFollowUp: input.nextFollowUp },
  });
  await audit(user.id, "contact.touched", "contact", input.contactId);
  revalidatePath("/contacts");
}

/**
 * Consent is the lawful basis for contacting a person (spec §8.1, §58.4), so
 * every change is audited with its previous value.
 */
export async function setContactConsent(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ contactId: idSchema, consent: z.enum(CONTACT_CONSENT) })
    .parse(formObject(formData));

  const before = await prisma.contact.findUnique({
    where: { id: input.contactId },
    select: { consent: true },
  });
  await prisma.contact.update({
    where: { id: input.contactId },
    data: { consent: input.consent },
  });
  await audit(user.id, "contact.consent", "contact", input.contactId, {
    from: before?.consent,
    to: input.consent,
  });
  revalidatePath("/contacts");
}

export async function deleteContact(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z.object({ contactId: idSchema }).parse(formObject(formData));
  await prisma.contact.delete({ where: { id: input.contactId } });
  await audit(user.id, "contact.deleted", "contact", input.contactId);
  revalidatePath("/contacts");
}
