"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";

const optionalId = z.string().cuid().optional().or(z.literal(""));

const placementSchema = z.object({
  customerId: idSchema,
  productId: optionalId,
  dealId: optionalId,
  model: z.string().trim().max(150).optional().or(z.literal("")),
  serialNumber: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type MachineFormState = {
  error?: string;
  savedId?: string;
};

/** Registreert dat een automaat bij een klant staat. Geen onderhoudsplanning — alleen dit. */
export async function registerMachinePlacement(
  _previous: MachineFormState,
  formData: FormData
): Promise<MachineFormState> {
  const user = await requireUser(["admin", "sales"]);
  const parsed = placementSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Controleer de gegevens" };
  }
  const input = parsed.data;

  const placement = await prisma.machinePlacement.create({
    data: {
      customerId: input.customerId,
      productId: input.productId || null,
      dealId: input.dealId || null,
      model: input.model || null,
      serialNumber: input.serialNumber || null,
      address: input.address || null,
      city: input.city || null,
      notes: input.notes || null,
    },
  });

  await audit(user.id, "machine.placed", "machine", placement.id, {
    customerId: input.customerId,
    model: input.model || undefined,
  });
  revalidatePath(`/klanten/${input.customerId}`);
  return { savedId: placement.id };
}

export async function markMachineRemoved(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ placementId: idSchema, customerId: idSchema })
    .parse(formObject(formData));

  await prisma.machinePlacement.update({
    where: { id: input.placementId },
    data: { status: "REMOVED", removedAt: new Date() },
  });

  await audit(user.id, "machine.removed", "machine", input.placementId, {
    customerId: input.customerId,
  });
  revalidatePath(`/klanten/${input.customerId}`);
  revalidatePath("/shop");
  revalidatePath(`/shop/${input.customerId}`);
}
