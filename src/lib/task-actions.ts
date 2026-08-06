"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { TASK_STATUSES } from "./constants";

const optionalId = z.string().cuid().optional().or(z.literal("")).transform((v) => v || null);
const taskStatusSchema = z.enum(TASK_STATUSES);

export async function createTask(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({
      title: z.string().trim().min(1).max(300),
      description: z.string().trim().max(2000).optional(),
      dueAt: z.string().optional(),
      priority: z.coerce.number().int().min(0).max(100).default(50),
      leadId: optionalId,
      customerId: optionalId,
      dealId: optionalId,
      assignedToId: optionalId,
    })
    .parse(formObject(formData));

  let dueAt: Date | null = null;
  if (input.dueAt) {
    const parsed = new Date(input.dueAt);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid due date");
    dueAt = parsed;
  }

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description || null,
      dueAt,
      priority: input.priority,
      leadId: input.leadId,
      customerId: input.customerId,
      dealId: input.dealId,
      assignedToId: input.assignedToId ?? user.id,
    },
  });
  await audit(user.id, "task.created", "task", task.id);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function setTaskStatus(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({ taskId: idSchema, status: taskStatusSchema })
    .parse(formObject(formData));

  const done = input.status === "DONE";
  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      status: input.status,
      completedAt: done ? new Date() : null,
    },
  });
  await audit(user.id, "task.status", "task", input.taskId, { status: input.status });
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function reassignTask(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ taskId: idSchema, assignedToId: optionalId })
    .parse(formObject(formData));
  await prisma.task.update({
    where: { id: input.taskId },
    data: { assignedToId: input.assignedToId },
  });
  await audit(user.id, "task.reassigned", "task", input.taskId, {
    assignedToId: input.assignedToId,
  });
  revalidatePath("/tasks");
}
