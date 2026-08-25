"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { prisma } from "./db";
import { formObject, idSchema } from "./validation";

const optionalId = idSchema.optional().or(z.literal(""));

export async function createContentItem(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      title: z.string().trim().min(1).max(200),
      theme: z.enum(["CUSTOMER", "INSTALLATION", "MACHINE", "FAQ"]),
      channel: z.enum(["LINKEDIN", "FACEBOOK", "INSTAGRAM", "MAIL", "WEBSITE"]),
      plannedAt: z.string().optional().or(z.literal("")),
      notes: z.string().trim().max(5000).optional().or(z.literal("")),
      customerId: optionalId,
      machinePlacementId: optionalId,
    })
    .parse(formObject(formData));
  const item = await prisma.contentItem.create({
    data: {
      title: input.title,
      theme: input.theme,
      channel: input.channel,
      plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
      notes: input.notes || null,
      customerId: input.customerId || null,
      machinePlacementId: input.machinePlacementId || null,
      status: "DRAFT",
    },
  });
  await audit(user.id, "content.created", "content", item.id);
  revalidatePath("/reclame/content");
}

export async function updateContentItemStatus(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      itemId: idSchema,
      status: z.enum(["DRAFT", "READY", "APPROVED", "PUBLISHED"]),
    })
    .parse(formObject(formData));
  if (
    user.role !== "admin" &&
    (input.status === "APPROVED" || input.status === "PUBLISHED")
  ) {
    throw new Error("Alleen een beheerder kan content goedkeuren of publiceren");
  }
  await prisma.contentItem.update({
    where: { id: input.itemId },
    data: { status: input.status },
  });
  await audit(user.id, "content.status_changed", "content", input.itemId, {
    status: input.status,
  });
  revalidatePath("/reclame/content");
}
