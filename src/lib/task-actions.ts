"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";

const optionalId = z.string().cuid().optional().or(z.literal(""));

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  dueAt: z.string().optional().or(z.literal("")),
  leadId: optionalId,
  customerId: optionalId,
});

/**
 * Een taak toevoegen, met de hand — geen cadans hier.
 *
 * Moet aan een lead óf een klant hangen (of geen van beide, voor iets los).
 * Nooit allebei tegelijk: een taak die aan twee dingen hangt, hoort ergens
 * niet meer thuis als een van de twee verwijderd wordt.
 */
export async function createTask(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = createSchema.parse(formObject(formData));

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description || null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      leadId: input.leadId || null,
      customerId: input.customerId || null,
      assignedToId: user.id,
      status: "OPEN",
    },
  });

  await audit(user.id, "task.created", "task", task.id, { titel: input.title });
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  if (input.customerId) revalidatePath(`/klanten/${input.customerId}`);
  revalidatePath("/taken");
  revalidatePath("/");
}

async function setStatus(
  taskId: string,
  status: "DONE" | "CANCELLED",
  action: "task.completed" | "task.cancelled"
) {
  const user = await requireUser(["admin", "sales"]);
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
    select: { leadId: true, customerId: true },
  });

  await audit(user.id, action, "task", taskId);
  if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
  if (task.customerId) revalidatePath(`/klanten/${task.customerId}`);
  revalidatePath("/taken");
  revalidatePath("/");
}

export async function completeTask(formData: FormData) {
  const input = z.object({ taskId: idSchema }).parse(formObject(formData));
  await setStatus(input.taskId, "DONE", "task.completed");
}

export async function cancelTask(formData: FormData) {
  const input = z.object({ taskId: idSchema }).parse(formObject(formData));
  await setStatus(input.taskId, "CANCELLED", "task.cancelled");
}
