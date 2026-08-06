"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import {
  ASSET_STATUSES,
  BRAND_ASSET_TYPES,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  CREATIVE_STATUSES,
  CREATIVE_TYPES,
} from "./constants";

const optionalText = (max = 2000) =>
  z.string().trim().max(max).optional().transform((v) => v || null);
const optionalId = z.string().cuid().optional().or(z.literal("")).transform((v) => v || null);
const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);
const optionalMoney = z.preprocess(
  emptyToUndef,
  z.coerce.number().finite().min(0).max(100_000_000).optional()
);
const optionalInt = z.preprocess(
  emptyToUndef,
  z.coerce.number().int().min(0).max(1_000_000).optional()
);
const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

export async function createCampaign(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      name: z.string().trim().min(1).max(300),
      objective: z.enum(CAMPAIGN_OBJECTIVES).optional(),
      audience: optionalText(500),
      offer: optionalText(500),
      budget: optionalMoney,
      startAt: optionalDate,
      endAt: optionalDate,
      channels: optionalText(300),
      landingPage: optionalText(2048),
      notes: optionalText(5000),
    })
    .parse(formObject(formData));

  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      objective: input.objective ?? "LEAD_GENERATION",
      audience: input.audience,
      offer: input.offer,
      budget: input.budget ?? 0,
      startAt: input.startAt,
      endAt: input.endAt,
      channels: input.channels,
      landingPage: input.landingPage,
      notes: input.notes,
    },
  });
  await audit(user.id, "campaign.created", "campaign", campaign.id);
  revalidatePath("/marketing");
}

export async function updateCampaignResults(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      campaignId: idSchema,
      status: z.enum(CAMPAIGN_STATUSES),
      spend: optionalMoney,
      leadsGenerated: optionalInt,
    })
    .parse(formObject(formData));

  await prisma.campaign.update({
    where: { id: input.campaignId },
    data: {
      status: input.status,
      spend: input.spend ?? 0,
      leadsGenerated: input.leadsGenerated ?? 0,
    },
  });
  await audit(user.id, "campaign.updated", "campaign", input.campaignId);
  revalidatePath("/marketing");
}

export async function createCreativeRequest(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({
      title: z.string().trim().min(1).max(300),
      type: z.enum(CREATIVE_TYPES).optional(),
      objective: optionalText(1000),
      audience: optionalText(500),
      platform: optionalText(100),
      format: optionalText(100),
      dimensions: optionalText(100),
      durationSec: optionalInt,
      mainMessage: optionalText(1000),
      cta: optionalText(200),
      language: z.string().trim().max(10).optional(),
      deadline: optionalDate,
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      campaignId: optionalId,
      customerId: optionalId,
      dealId: optionalId,
      productId: optionalId,
      assignedToId: optionalId,
      referenceUrls: optionalText(2048),
      notes: optionalText(5000),
    })
    .parse(formObject(formData));

  const request = await prisma.creativeRequest.create({
    data: {
      code: `MATO-MKT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      title: input.title,
      type: input.type ?? "SOCIAL_POST",
      objective: input.objective,
      audience: input.audience,
      platform: input.platform,
      format: input.format,
      dimensions: input.dimensions,
      durationSec: input.durationSec,
      mainMessage: input.mainMessage,
      cta: input.cta,
      language: input.language || "nl",
      deadline: input.deadline,
      priority: input.priority ?? "NORMAL",
      status: input.assignedToId ? "ASSIGNED" : "SUBMITTED",
      campaignId: input.campaignId,
      customerId: input.customerId,
      dealId: input.dealId,
      productId: input.productId,
      assignedToId: input.assignedToId,
      requestedById: user.id,
      referenceUrls: input.referenceUrls,
      notes: input.notes,
    },
  });
  await audit(user.id, "creative.created", "creative_request", request.id);
  revalidatePath("/marketing");
  redirect(`/marketing/creatives/${request.id}`);
}

export async function setCreativeStatus(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({
      requestId: idSchema,
      status: z.enum(CREATIVE_STATUSES),
      assignedToId: optionalId,
    })
    .parse(formObject(formData));

  await prisma.creativeRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.status,
      ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
      // Approval is recorded only by approveCreative, never by a status change.
      ...(input.status === "APPROVED" ? {} : { approvedById: null, approvedAt: null }),
    },
  });
  await audit(user.id, "creative.status", "creative_request", input.requestId, {
    status: input.status,
  });
  revalidatePath(`/marketing/creatives/${input.requestId}`);
  revalidatePath("/marketing");
}

/** Final creative approval is a manager decision (spec §4.7, §30.3). */
export async function approveCreative(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z.object({ requestId: idSchema }).parse(formObject(formData));

  const request = await prisma.creativeRequest.findUnique({
    where: { id: input.requestId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!request) throw new Error("Creative request not found");
  if (request.versions.length === 0) {
    throw new Error("Cannot approve a creative that has no version uploaded");
  }

  await prisma.creativeRequest.update({
    where: { id: input.requestId },
    data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
  });
  await audit(user.id, "creative.approved", "creative_request", input.requestId, {
    version: request.versions[0].version,
  });
  revalidatePath(`/marketing/creatives/${input.requestId}`);
  revalidatePath("/marketing");
}

export async function addCreativeVersion(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({
      requestId: idSchema,
      fileUrl: optionalText(2048),
      summary: optionalText(2000),
    })
    .parse(formObject(formData));

  const last = await prisma.creativeVersion.findFirst({
    where: { requestId: input.requestId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  await prisma.creativeVersion.create({
    data: {
      requestId: input.requestId,
      version,
      fileUrl: input.fileUrl,
      summary: input.summary,
      createdById: user.id,
    },
  });
  // A new version supersedes any prior approval — it has not been reviewed yet.
  await prisma.creativeRequest.update({
    where: { id: input.requestId },
    data: { status: "INTERNAL_REVIEW", approvedById: null, approvedAt: null },
  });
  await audit(user.id, "creative.version_added", "creative_request", input.requestId, {
    version,
  });
  revalidatePath(`/marketing/creatives/${input.requestId}`);
}

export async function requestCreativeRevision(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ requestId: idSchema, feedback: z.string().trim().min(1).max(2000) })
    .parse(formObject(formData));

  const latest = await prisma.creativeVersion.findFirst({
    where: { requestId: input.requestId },
    orderBy: { version: "desc" },
  });
  if (latest) {
    await prisma.creativeVersion.update({
      where: { id: latest.id },
      data: { feedback: input.feedback },
    });
  }
  await prisma.creativeRequest.update({
    where: { id: input.requestId },
    data: { status: "REVISION_REQUESTED", approvedById: null, approvedAt: null },
  });
  await audit(user.id, "creative.revision_requested", "creative_request", input.requestId);
  revalidatePath(`/marketing/creatives/${input.requestId}`);
}

export async function createBrandAsset(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({
      name: z.string().trim().min(1).max(300),
      type: z.enum(BRAND_ASSET_TYPES).optional(),
      fileUrl: optionalText(2048),
      description: optionalText(2000),
      language: optionalText(10),
      fileFormat: optionalText(20),
      dimensions: optionalText(100),
      usageRights: optionalText(500),
      tags: optionalText(500),
      expiresAt: optionalDate,
      campaignId: optionalId,
      productId: optionalId,
    })
    .parse(formObject(formData));

  const asset = await prisma.brandAsset.create({
    data: {
      name: input.name,
      type: input.type ?? "IMAGE",
      fileUrl: input.fileUrl,
      description: input.description,
      language: input.language,
      fileFormat: input.fileFormat,
      dimensions: input.dimensions,
      usageRights: input.usageRights,
      tags: input.tags,
      expiresAt: input.expiresAt,
      campaignId: input.campaignId,
      productId: input.productId,
      ownerId: user.id,
    },
  });
  await audit(user.id, "asset.created", "brand_asset", asset.id);
  revalidatePath("/marketing/brand");
}

export async function setAssetStatus(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ assetId: idSchema, status: z.enum(ASSET_STATUSES) })
    .parse(formObject(formData));
  await prisma.brandAsset.update({
    where: { id: input.assetId },
    data: { status: input.status },
  });
  await audit(user.id, "asset.status", "brand_asset", input.assetId, { status: input.status });
  revalidatePath("/marketing/brand");
}
