"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelCadence } from "./cadence-actions";
import { prisma } from "./db";
import { requireUser } from "./dal";
import { formObject, idSchema } from "./validation";

const stopSchema = z.object({
  leadId: idSchema,
  reason: z.enum([
    "NO_INTEREST",
    "TIMING",
    "PRICE",
    "NO_FIT",
    "COMPETITOR",
    "UNREACHABLE",
    "DUPLICATE",
    "OTHER",
  ]),
  disposition: z.enum(["RELEASE", "PARK", "LOST"]),
  parkedUntil: z.string().optional().or(z.literal("")),
});

export async function stopLead(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = stopSchema.parse(formObject(formData));
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { ownerId: true, owner: { select: { name: true } } },
  });
  if (!lead) throw new Error("Lead niet gevonden");
  if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
    throw new Error(`Deze lead staat op naam van ${lead.owner?.name ?? "een collega"}`);
  }

  const now = new Date();
  const defaultParkDate = new Date(now);
  defaultParkDate.setUTCDate(defaultParkDate.getUTCDate() + 90);
  const parkedUntil =
    input.disposition === "PARK"
      ? input.parkedUntil
        ? new Date(input.parkedUntil)
        : defaultParkDate
      : null;
  if (parkedUntil && Number.isNaN(parkedUntil.getTime())) {
    throw new Error("Ongeldige datum");
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: input.leadId },
      data:
        input.disposition === "LOST"
          ? {
              status: "LOST",
              lossReason: input.reason,
              parkedUntil: null,
              nextActionAt: null,
              claimedById: null,
              claimedAt: null,
              lastTouchedAt: now,
            }
          : input.disposition === "PARK"
            ? {
                status: "FOLLOW_UP",
                lossReason: input.reason,
                parkedUntil,
                nextActionAt: parkedUntil,
                claimedById: null,
                claimedAt: null,
                lastTouchedAt: now,
              }
            : {
                status: "CONTACTED",
                lossReason: input.reason,
                parkedUntil: null,
                nextActionAt: null,
                ownerId: null,
                ownedAt: null,
                claimedById: null,
                claimedAt: null,
                lastTouchedAt: now,
              },
    });
    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "lead.stopped",
        entityType: "lead",
        entityId: input.leadId,
        detail: JSON.stringify({
          reason: input.reason,
          disposition: input.disposition,
          parkedUntil: parkedUntil?.toISOString() ?? null,
        }),
      },
    });
  });

  await cancelCadence({ leadId: input.leadId }, "LEAD_FOLLOWUP");
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/leads");
  revalidatePath("/");
}
