"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { prisma } from "./db";
import { formObject, idSchema } from "./validation";

export async function saveMailStyle(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      userId: idSchema,
      mailStyleNotes: z.string().trim().max(5000).optional().or(z.literal("")),
    })
    .parse(formObject(formData));
  if (user.role !== "admin" && user.id !== input.userId) {
    throw new Error("Je kunt alleen je eigen mailstijl aanpassen");
  }
  await prisma.user.update({
    where: { id: input.userId },
    data: { mailStyleNotes: input.mailStyleNotes || null },
  });
  await audit(user.id, "mail_style.updated", "user", input.userId);
  revalidatePath(`/team/${input.userId}`);
}

export async function saveMailAsExample(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ mailMessageId: idSchema, leadId: idSchema })
    .parse(formObject(formData));
  const message = await prisma.mailMessage.findFirst({
    where: { id: input.mailMessageId, direction: "OUT" },
    select: { id: true, userId: true, subject: true, body: true },
  });
  if (!message) throw new Error("Verstuurde mail niet gevonden");
  if (message.userId && message.userId !== user.id && user.role !== "admin") {
    throw new Error("Je kunt alleen je eigen mails als voorbeeld bewaren");
  }
  const targetUserId = message.userId ?? user.id;
  const existing = await prisma.mailExample.findFirst({
    where: { userId: targetUserId, sourceMailMessageId: message.id },
    select: { id: true },
  });
  if (!existing) {
    await prisma.mailExample.create({
      data: {
        userId: targetUserId,
        subject: message.subject,
        body: message.body,
        approved: true,
        sourceMailMessageId: message.id,
      },
    });
  }
  await audit(user.id, "mail_style.example_saved", "mail", message.id, {
    userId: targetUserId,
  });
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath(`/team/${targetUserId}`);
}

export async function deleteMailExample(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ exampleId: idSchema, userId: idSchema })
    .parse(formObject(formData));
  if (user.role !== "admin" && user.id !== input.userId) {
    throw new Error("Je kunt alleen je eigen voorbeelden verwijderen");
  }
  await prisma.mailExample.delete({
    where: { id: input.exampleId, userId: input.userId },
  });
  revalidatePath(`/team/${input.userId}`);
}
