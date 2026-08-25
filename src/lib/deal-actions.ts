"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  cancelCadence,
  enrollCustomerOnboarding,
} from "./cadence-actions";
import { stepsFor } from "./cadences";
import { requireUser } from "./dal";
import { prisma } from "./db";
import { formObject, idSchema } from "./validation";

const optionalId = z.string().cuid().optional().or(z.literal(""));

function optionalDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Ongeldige datum");
  return date;
}

async function assertLeadAccess(leadId: string, user: { id: string; role: string }) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { customer: true, owner: { select: { name: true } } },
  });
  if (!lead) throw new Error("Lead niet gevonden");
  if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
    throw new Error(`Deze lead staat op naam van ${lead.owner?.name ?? "een collega"}`);
  }
  return lead;
}

export async function saveDeal(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      leadId: idSchema,
      dealId: optionalId,
      title: z.string().trim().min(1).max(200),
      stage: z.enum(["QUALIFIED", "PROPOSAL", "NEGOTIATION"]),
      expectedValue: z.coerce.number().min(0).max(10_000_000),
      probability: z.coerce.number().int().min(0).max(100),
      expectedCloseAt: z.string().optional().or(z.literal("")),
      nextStep: z.string().trim().min(1).max(1000),
      expectedMachineCount: z.coerce.number().int().min(1).max(100),
      productId: optionalId,
      unitPrice: z.coerce.number().min(0).max(10_000_000).optional(),
    })
    .parse(formObject(formData));
  const lead = await assertLeadAccess(input.leadId, user);
  const expectedCloseAt = optionalDate(input.expectedCloseAt);

  await prisma.$transaction(async (tx) => {
    const data = {
      title: input.title,
      stage: input.stage,
      expectedValue: input.expectedValue,
      probability: input.probability,
      expectedCloseAt,
      nextStep: input.nextStep,
      expectedMachineCount: input.expectedMachineCount,
      ownerId: lead.ownerId ?? user.id,
      lastActivityAt: new Date(),
    };
    const deal = input.dealId
      ? await tx.deal.update({
          where: { id: input.dealId, leadId: lead.id },
          data,
        })
      : await tx.deal.create({
          data: { ...data, leadId: lead.id },
        });

    if (input.productId) {
      const existingLine = await tx.dealLine.findFirst({
        where: { dealId: deal.id, productId: input.productId },
        select: { id: true },
      });
      const lineData = {
        qty: input.expectedMachineCount,
        unitPrice: input.unitPrice ?? input.expectedValue,
      };
      if (existingLine) {
        await tx.dealLine.update({
          where: { id: existingLine.id },
          data: lineData,
        });
      } else {
        await tx.dealLine.create({
          data: {
            dealId: deal.id,
            productId: input.productId,
            ...lineData,
          },
        });
      }
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: "NEGOTIATION",
        ownerId: lead.ownerId ?? user.id,
        ownedAt: lead.ownedAt ?? new Date(),
        nextActionAt: expectedCloseAt,
        lastTouchedAt: new Date(),
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: input.dealId ? "deal.updated" : "deal.created",
        entityType: "deal",
        entityId: deal.id,
        detail: JSON.stringify({
          leadId: lead.id,
          stage: input.stage,
          expectedValue: input.expectedValue,
          nextStep: input.nextStep,
        }),
      },
    });
    return deal;
  });

  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/deals");
  revalidatePath("/");
}

export async function markDealLost(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      dealId: idSchema,
      leadId: idSchema,
      lossReason: z.string().trim().min(1).max(100),
    })
    .parse(formObject(formData));
  await assertLeadAccess(input.leadId, user);
  await prisma.$transaction([
    prisma.deal.update({
      where: { id: input.dealId, leadId: input.leadId },
      data: { stage: "LOST", lossReason: input.lossReason, lastActivityAt: new Date() },
    }),
    prisma.lead.update({
      where: { id: input.leadId },
      data: {
        status: "LOST",
        lossReason: input.lossReason,
        nextActionAt: null,
        lastTouchedAt: new Date(),
      },
    }),
    prisma.auditEvent.create({
      data: {
        actorId: user.id,
        action: "deal.lost",
        entityType: "deal",
        entityId: input.dealId,
        detail: JSON.stringify({ reason: input.lossReason }),
      },
    }),
  ]);
  await cancelCadence({ leadId: input.leadId }, "LEAD_FOLLOWUP");
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/deals");
  revalidatePath("/");
}

export async function closeDealWithHandoff(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      leadId: idSchema,
      dealId: optionalId,
      title: z.string().trim().min(1).max(200),
      value: z.coerce.number().min(0).max(10_000_000),
      productId: idSchema,
      model: z.string().trim().max(150).optional().or(z.literal("")),
      serialNumber: z.string().trim().max(100).optional().or(z.literal("")),
      address: z.string().trim().min(1).max(250),
      city: z.string().trim().min(1).max(100),
      installAt: z.string().optional().or(z.literal("")),
    })
    .parse(formObject(formData));
  const lead = await assertLeadAccess(input.leadId, user);
  const now = new Date();
  const installAt = optionalDate(input.installAt) ?? now;

  const result = await prisma.$transaction(async (tx) => {
    const existingDeal = input.dealId
      ? await tx.deal.findUnique({ where: { id: input.dealId } })
      : null;
    if (existingDeal?.stage === "WON") {
      throw new Error("Deze deal is al gewonnen");
    }

    const customer =
      lead.customer ??
      (await tx.customer.create({
        data: {
          name: lead.name,
          address: lead.address,
          city: lead.city,
          province: lead.province,
          phone: lead.phone,
          email: lead.email,
          website: lead.website,
          leadId: lead.id,
          kind: "BUYER",
          ownerId: lead.ownerId ?? user.id,
        },
      }));

    const deal = input.dealId
      ? await tx.deal.update({
          where: { id: input.dealId, leadId: lead.id },
          data: {
            title: input.title,
            stage: "WON",
            customerId: customer.id,
            ownerId: lead.ownerId ?? user.id,
            wonValue: input.value,
            expectedValue: input.value,
            probability: 100,
            wonAt: now,
            lastActivityAt: now,
            nextStep: "Installatie en opstart",
          },
        })
      : await tx.deal.create({
          data: {
            title: input.title,
            stage: "WON",
            leadId: lead.id,
            customerId: customer.id,
            ownerId: lead.ownerId ?? user.id,
            wonValue: input.value,
            expectedValue: input.value,
            probability: 100,
            wonAt: now,
            lastActivityAt: now,
            nextStep: "Installatie en opstart",
          },
        });

    const line = await tx.dealLine.findFirst({
      where: { dealId: deal.id, productId: input.productId },
      select: { id: true },
    });
    if (line) {
      await tx.dealLine.update({
        where: { id: line.id },
        data: { qty: 1, unitPrice: input.value },
      });
    } else {
      await tx.dealLine.create({
        data: {
          dealId: deal.id,
          productId: input.productId,
          qty: 1,
          unitPrice: input.value,
        },
      });
    }

    const placement = await tx.machinePlacement.create({
      data: {
        customerId: customer.id,
        dealId: deal.id,
        productId: input.productId,
        model: input.model || null,
        serialNumber: input.serialNumber || null,
        address: input.address,
        city: input.city,
        site: "EXTERNAL",
        placedAt: installAt,
        status: "ACTIVE",
      },
    });

    await tx.task.createMany({
      data: stepsFor("INSTALL_HANDOFF", installAt).map((step) => ({
        title: step.title,
        customerId: customer.id,
        dealId: deal.id,
        assignedToId: lead.ownerId ?? user.id,
        dueAt: step.dueAt,
        cadenceKey: "INSTALL_HANDOFF",
        cadenceStep: step.step,
        status: "OPEN",
      })),
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: "WON",
        nextActionAt: null,
        lastTouchedAt: now,
        claimedById: null,
        claimedAt: null,
        ownerId: lead.ownerId ?? user.id,
        lossReason: null,
        parkedUntil: null,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "deal.won_handoff",
        entityType: "deal",
        entityId: deal.id,
        detail: JSON.stringify({
          leadId: lead.id,
          customerId: customer.id,
          placementId: placement.id,
          value: input.value,
          installAt: installAt.toISOString(),
        }),
      },
    });
    return { customer, deal };
  });

  await Promise.all([
    cancelCadence({ leadId: lead.id }, "LEAD_FOLLOWUP"),
    enrollCustomerOnboarding(result.customer.id, result.deal.ownerId ?? user.id),
  ]);
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath(`/klanten/${result.customer.id}`);
  revalidatePath("/deals");
  revalidatePath("/klanten");
  revalidatePath("/taken");
  revalidatePath("/");
  redirect(`/klanten/${result.customer.id}`);
}
