"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { prisma } from "./db";
import { formObject, idSchema } from "./validation";

const optionalText = z.string().trim().max(1000).optional().or(z.literal(""));
const optionalDate = z.string().optional().or(z.literal(""));

export async function createCampaign(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      name: z.string().trim().min(1).max(160),
      objective: z.enum(["LEAD_GENERATION", "SALES", "SHOP_RENTAL"]),
      audience: optionalText,
      offer: optionalText,
      budget: z.coerce.number().min(0).max(10_000_000),
      channels: optionalText,
      landingPage: z.string().trim().url().optional().or(z.literal("")),
      startAt: optionalDate,
      endAt: optionalDate,
    })
    .parse(formObject(formData));
  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      objective: input.objective,
      audience: input.audience || null,
      offer: input.offer || null,
      budget: input.budget,
      channels: input.channels || null,
      landingPage: input.landingPage || null,
      startAt: input.startAt ? new Date(input.startAt) : null,
      endAt: input.endAt ? new Date(input.endAt) : null,
      status: "PLANNED",
    },
  });
  await audit(user.id, "campaign.created", "campaign", campaign.id);
  revalidatePath("/reclame");
}

export async function updateCampaign(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      campaignId: idSchema,
      status: z.enum(["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"]),
      spend: z.coerce.number().min(0).max(10_000_000),
    })
    .parse(formObject(formData));
  await prisma.campaign.update({
    where: { id: input.campaignId },
    data: { status: input.status, spend: input.spend },
  });
  await audit(user.id, "campaign.updated", "campaign", input.campaignId, {
    status: input.status,
    spend: input.spend,
  });
  revalidatePath("/reclame");
}

export async function assignLeadCampaign(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      leadId: idSchema,
      campaignId: idSchema.optional().or(z.literal("")),
    })
    .parse(formObject(formData));
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { ownerId: true },
  });
  if (!lead) throw new Error("Lead niet gevonden");
  if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
    throw new Error("Deze lead staat op naam van een collega");
  }
  await prisma.lead.update({
    where: { id: input.leadId },
    data: { campaignId: input.campaignId || null },
  });
  await audit(user.id, "lead.campaign_assigned", "lead", input.leadId, {
    campaignId: input.campaignId || null,
  });
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/reclame");
}
