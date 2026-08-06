"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { SOURCING_PRIORITIES, SOURCING_STATUSES, SUPPLIER_STATUSES } from "./constants";

const optionalText = (max = 2000) =>
  z.string().trim().max(max).optional().transform((v) => v || null);
/** Blank form fields arrive as "" — treat them as unset, never as 0. */
const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);
const optionalMoney = z.preprocess(
  emptyToUndef,
  z.coerce.number().finite().min(0).max(100_000_000).optional()
);
const optionalInt = z.preprocess(
  emptyToUndef,
  z.coerce.number().int().min(0).max(100_000_000).optional()
);
const optionalPct = z.preprocess(
  emptyToUndef,
  z.coerce.number().min(0).max(100).optional()
);
const optionalId = z.string().cuid().optional().or(z.literal("")).transform((v) => v || null);

const supplierStatusSchema = z.enum(SUPPLIER_STATUSES);
const sourcingStatusSchema = z.enum(SOURCING_STATUSES);
const prioritySchema = z.enum(SOURCING_PRIORITIES);

export async function createSupplier(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({
      name: z.string().trim().min(1).max(300),
      platform: optionalText(100),
      storeUrl: optionalText(2048),
      website: optionalText(2048),
      contactPerson: optionalText(200),
      email: optionalText(320),
      phone: optionalText(50),
      wechat: optionalText(100),
      whatsapp: optionalText(50),
      country: z.string().trim().max(100).optional(),
      factoryType: z.enum(["FACTORY", "TRADER", "UNKNOWN"]).optional(),
      categories: optionalText(500),
      currency: z.string().trim().max(10).optional(),
      paymentTerms: optionalText(300),
      moq: optionalInt,
      leadTimeDays: optionalInt,
      sampleTerms: optionalText(300),
      notes: optionalText(5000),
    })
    .parse(formObject(formData));

  const supplier = await prisma.supplier.create({
    data: {
      ...input,
      country: input.country || "China",
      currency: input.currency || "USD",
      factoryType: input.factoryType ?? "UNKNOWN",
    },
  });
  await audit(user.id, "supplier.created", "supplier", supplier.id);
  revalidatePath("/suppliers");
  redirect(`/suppliers/${supplier.id}`);
}

export async function updateSupplierScores(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      supplierId: idSchema,
      qualityScore: z.coerce.number().int().min(0).max(25),
      priceScore: z.coerce.number().int().min(0).max(20),
      reliabilityScore: z.coerce.number().int().min(0).max(20),
      communicationScore: z.coerce.number().int().min(0).max(15),
      flexibilityScore: z.coerce.number().int().min(0).max(10),
      documentationScore: z.coerce.number().int().min(0).max(10),
      adjustedScore: z.preprocess(
        emptyToUndef,
        z.coerce.number().int().min(0).max(100).optional()
      ),
      adjustmentReason: optionalText(1000),
      status: supplierStatusSchema,
      riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    })
    .parse(formObject(formData));

  const adjusted = input.adjustedScore ?? null;
  if (adjusted != null && !input.adjustmentReason) {
    throw new Error("An adjusted score requires an adjustment reason");
  }

  await prisma.supplier.update({
    where: { id: input.supplierId },
    data: {
      qualityScore: input.qualityScore,
      priceScore: input.priceScore,
      reliabilityScore: input.reliabilityScore,
      communicationScore: input.communicationScore,
      flexibilityScore: input.flexibilityScore,
      documentationScore: input.documentationScore,
      adjustedScore: adjusted,
      adjustmentReason: input.adjustmentReason,
      status: input.status,
      riskLevel: input.riskLevel,
      lastReviewAt: new Date(),
    },
  });
  await audit(user.id, "supplier.scored", "supplier", input.supplierId, {
    status: input.status,
    adjusted,
  });
  revalidatePath(`/suppliers/${input.supplierId}`);
  revalidatePath("/suppliers");
}

export async function createSourcingRequest(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({
      title: z.string().trim().min(1).max(300),
      category: z.string().trim().max(100).optional(),
      description: optionalText(5000),
      refUrls: optionalText(2048),
      dimensions: optionalText(300),
      materials: optionalText(300),
      colours: optionalText(300),
      printing: optionalText(300),
      quantity: z.preprocess(
        emptyToUndef,
        z.coerce.number().int().min(0).max(100_000_000).default(0)
      ),
      targetUnitCost: optionalMoney,
      targetSellPrice: optionalMoney,
      requiredMarginPct: z.preprocess(
        emptyToUndef,
        z.coerce.number().min(0).max(99).optional()
      ),
      maxMoq: optionalInt,
      requiredBy: z.string().optional(),
      sampleRequired: z.string().optional(),
      priority: prioritySchema.optional(),
      customerId: optionalId,
      dealId: optionalId,
      notes: optionalText(5000),
    })
    .parse(formObject(formData));

  const request = await prisma.sourcingRequest.create({
    data: {
      code: `MATO-SRC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      title: input.title,
      category: input.category || "PACKAGING",
      description: input.description,
      refUrls: input.refUrls,
      dimensions: input.dimensions,
      materials: input.materials,
      colours: input.colours,
      printing: input.printing,
      quantity: input.quantity,
      targetUnitCost: input.targetUnitCost,
      targetSellPrice: input.targetSellPrice,
      requiredMarginPct: input.requiredMarginPct,
      maxMoq: input.maxMoq,
      requiredBy: input.requiredBy ? new Date(input.requiredBy) : null,
      sampleRequired: input.sampleRequired === "on",
      priority: input.priority ?? "NORMAL",
      customerId: input.customerId,
      dealId: input.dealId,
      requestedById: user.id,
      notes: input.notes,
    },
  });
  await audit(user.id, "sourcing.created", "sourcing_request", request.id);
  revalidatePath("/sourcing");
  redirect(`/sourcing/${request.id}`);
}

export async function updateSourcingStatus(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ requestId: idSchema, status: sourcingStatusSchema })
    .parse(formObject(formData));
  await prisma.sourcingRequest.update({
    where: { id: input.requestId },
    data: { status: input.status },
  });
  await audit(user.id, "sourcing.status", "sourcing_request", input.requestId, {
    status: input.status,
  });
  revalidatePath(`/sourcing/${input.requestId}`);
  revalidatePath("/sourcing");
}

export async function addSupplierQuote(formData: FormData) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const input = z
    .object({
      requestId: idSchema,
      supplierId: idSchema,
      title: optionalText(300),
      productUrl: optionalText(2048),
      currency: z.string().trim().max(10).optional(),
      fxToEur: z.preprocess(
        emptyToUndef,
        z.coerce.number().positive().max(1000).default(1)
      ),
      unitPrice: z.coerce.number().finite().min(0).max(100_000_000),
      moq: optionalInt,
      sampleCost: optionalMoney,
      setupCost: optionalMoney,
      mouldCost: optionalMoney,
      domesticShipping: optionalMoney,
      intlShipping: optionalMoney,
      customsPct: optionalPct,
      extraFees: optionalMoney,
      contingencyPct: optionalPct,
      productionDays: optionalInt,
      notes: optionalText(2000),
    })
    .parse(formObject(formData));

  const quote = await prisma.supplierQuote.create({
    data: {
      requestId: input.requestId,
      supplierId: input.supplierId,
      title: input.title,
      productUrl: input.productUrl,
      currency: input.currency || "USD",
      fxToEur: input.fxToEur,
      unitPrice: input.unitPrice,
      moq: input.moq,
      sampleCost: input.sampleCost ?? 0,
      setupCost: input.setupCost ?? 0,
      mouldCost: input.mouldCost ?? 0,
      domesticShipping: input.domesticShipping ?? 0,
      intlShipping: input.intlShipping ?? 0,
      customsPct: input.customsPct ?? 0,
      extraFees: input.extraFees ?? 0,
      contingencyPct: input.contingencyPct ?? 3,
      productionDays: input.productionDays,
      notes: input.notes,
    },
  });
  await prisma.sourcingRequest.update({
    where: { id: input.requestId },
    data: { status: "QUOTES_RECEIVED" },
  });
  await audit(user.id, "sourcing.quote_added", "supplier_quote", quote.id, {
    requestId: input.requestId,
    supplierId: input.supplierId,
  });
  revalidatePath(`/sourcing/${input.requestId}`);
}

/** Final supplier selection stays a human management decision (spec §24). */
export async function selectSupplierQuote(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z
    .object({ requestId: idSchema, quoteId: idSchema })
    .parse(formObject(formData));

  const quote = await prisma.supplierQuote.findUnique({
    where: { id: input.quoteId },
    select: { requestId: true, supplierId: true },
  });
  if (!quote || quote.requestId !== input.requestId) {
    throw new Error("Quote does not belong to this sourcing request");
  }

  await prisma.$transaction([
    prisma.supplierQuote.updateMany({
      where: { requestId: input.requestId },
      data: { selected: false },
    }),
    prisma.supplierQuote.update({
      where: { id: input.quoteId },
      data: { selected: true },
    }),
    prisma.sourcingRequest.update({
      where: { id: input.requestId },
      data: { status: "SUPPLIER_SELECTED" },
    }),
  ]);
  await audit(user.id, "sourcing.supplier_selected", "sourcing_request", input.requestId, {
    quoteId: input.quoteId,
    supplierId: quote.supplierId,
  });
  revalidatePath(`/sourcing/${input.requestId}`);
  revalidatePath("/sourcing");
}
