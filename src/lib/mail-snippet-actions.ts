"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { MAIL_SITUATIONS } from "./constants";

const SITUATIONS = MAIL_SITUATIONS.map((s) => s.value) as [string, ...string[]];

const snippetSchema = z.object({
  situation: z.enum(SITUATIONS),
  label: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(4000),
});

export async function createMailSnippet(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = snippetSchema.parse(formObject(formData));

  const snippet = await prisma.mailSnippet.create({
    data: { ...input, updatedById: user.id },
  });

  await audit(user.id, "mail_snippet.created", "mail_snippet", snippet.id, {
    situatie: input.situation,
    label: input.label,
  });
  revalidatePath("/settings/mail-teksten");
}

const updateSchema = snippetSchema.extend({ snippetId: idSchema });

export async function updateMailSnippet(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = updateSchema.parse(formObject(formData));

  await prisma.mailSnippet.update({
    where: { id: input.snippetId },
    data: {
      situation: input.situation,
      label: input.label,
      body: input.body,
      updatedById: user.id,
    },
  });

  await audit(user.id, "mail_snippet.updated", "mail_snippet", input.snippetId);
  revalidatePath("/settings/mail-teksten");
}

/**
 * Zachte verwijdering — `active: false`, nooit een echte delete.
 *
 * Een `EmailDraft.sourceSnippetId` van een al verstuurde mail moet blijven
 * verwijzen naar iets bestaands, ook als die tekst niet meer aangeboden wordt.
 */
export async function archiveMailSnippet(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z.object({ snippetId: idSchema }).parse(formObject(formData));

  await prisma.mailSnippet.update({
    where: { id: input.snippetId },
    data: { active: false, updatedById: user.id },
  });

  await audit(user.id, "mail_snippet.archived", "mail_snippet", input.snippetId);
  revalidatePath("/settings/mail-teksten");
}
