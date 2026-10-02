"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { prisma } from "./db";
import { allocateNumber } from "./document-numbering";
import { formObject, idSchema } from "./validation";

const optionalId = z.string().cuid().optional().or(z.literal(""));

function optionalDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function createSourcingRequest(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      title: z.string().trim().min(2).max(200),
      category: z.enum(["PACKAGING", "MACHINE", "PARTS", "OTHER"]).default("PACKAGING"),
      description: z.string().trim().max(4000).optional().or(z.literal("")),
      quantity: z.coerce.number().int().min(1).max(10_000_000).default(1000),
      targetUnitCost: z.coerce.number().min(0).max(100_000).optional().or(z.literal("")),
      targetSellPrice: z.coerce.number().min(0).max(100_000).optional().or(z.literal("")),
      requiredMarginPct: z.coerce.number().min(0).max(99).optional().or(z.literal("")),
      maxMoq: z.coerce.number().int().min(0).max(10_000_000).optional().or(z.literal("")),
      requiredBy: z.string().optional().or(z.literal("")),
      customerId: optionalId,
      dealId: optionalId,
      priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
    })
    .parse(formObject(formData));

  const year = new Date().getUTCFullYear();
  const code = await allocateNumber("SR", year);

  const request = await prisma.sourcingRequest.create({
    data: {
      code,
      title: input.title,
      category: input.category,
      description: input.description || null,
      quantity: input.quantity,
      targetUnitCost:
        input.targetUnitCost === "" || input.targetUnitCost == null
          ? null
          : Number(input.targetUnitCost),
      targetSellPrice:
        input.targetSellPrice === "" || input.targetSellPrice == null
          ? null
          : Number(input.targetSellPrice),
      requiredMarginPct:
        input.requiredMarginPct === "" || input.requiredMarginPct == null
          ? null
          : Number(input.requiredMarginPct),
      maxMoq:
        input.maxMoq === "" || input.maxMoq == null
          ? null
          : Number(input.maxMoq),
      requiredBy: optionalDate(input.requiredBy),
      customerId: input.customerId || null,
      dealId: input.dealId || null,
      priority: input.priority,
      status: "SUBMITTED",
      requestedById: user.id,
    },
  });

  await audit(user.id, "sourcing.created", "sourcingRequest", request.id, {
    code: request.code,
  });
  revalidatePath("/sourcing");
  redirect(`/sourcing/${request.id}`);
}

export async function createSupplier(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      name: z.string().trim().min(2).max(200),
      country: z.string().trim().max(80).default("China"),
      currency: z.string().trim().max(8).default("USD"),
      email: z.union([z.literal(""), z.string().trim().email()]).optional(),
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
      returnTo: z.string().optional().or(z.literal("")),
    })
    .parse(formObject(formData));

  const supplier = await prisma.supplier.create({
    data: {
      name: input.name,
      country: input.country || "China",
      currency: input.currency || "USD",
      email: input.email || null,
      notes: input.notes || null,
      status: "ACTIVE",
    },
  });

  await audit(user.id, "supplier.created", "supplier", supplier.id, {
    name: supplier.name,
  });

  const back = input.returnTo?.startsWith("/sourcing")
    ? input.returnTo
    : "/sourcing";
  revalidatePath("/sourcing");
  redirect(back);
}

export async function addSupplierQuote(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      requestId: idSchema,
      supplierId: idSchema,
      title: z.string().trim().max(200).optional().or(z.literal("")),
      currency: z.string().trim().max(8).default("USD"),
      fxToEur: z.coerce.number().min(0.0001).max(100).default(1),
      unitPrice: z.coerce.number().min(0).max(1_000_000),
      moq: z.coerce.number().int().min(0).max(10_000_000).optional().or(z.literal("")),
      sampleCost: z.coerce.number().min(0).max(1_000_000).default(0),
      setupCost: z.coerce.number().min(0).max(1_000_000).default(0),
      mouldCost: z.coerce.number().min(0).max(1_000_000).default(0),
      domesticShipping: z.coerce.number().min(0).max(1_000_000).default(0),
      intlShipping: z.coerce.number().min(0).max(1_000_000).default(0),
      customsPct: z.coerce.number().min(0).max(100).default(0),
      extraFees: z.coerce.number().min(0).max(1_000_000).default(0),
      contingencyPct: z.coerce.number().min(0).max(50).default(3),
      productionDays: z.coerce
        .number()
        .int()
        .min(0)
        .max(730)
        .optional()
        .or(z.literal("")),
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .parse(formObject(formData));

  const request = await prisma.sourcingRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true },
  });
  if (!request) throw new Error("Aanvraag niet gevonden");

  const quote = await prisma.supplierQuote.create({
    data: {
      requestId: input.requestId,
      supplierId: input.supplierId,
      title: input.title || null,
      currency: input.currency || "USD",
      fxToEur: input.fxToEur,
      unitPrice: input.unitPrice,
      moq:
        input.moq === "" || input.moq == null ? null : Number(input.moq),
      sampleCost: input.sampleCost,
      setupCost: input.setupCost,
      mouldCost: input.mouldCost,
      domesticShipping: input.domesticShipping,
      intlShipping: input.intlShipping,
      customsPct: input.customsPct,
      extraFees: input.extraFees,
      contingencyPct: input.contingencyPct,
      productionDays:
        input.productionDays === "" || input.productionDays == null
          ? null
          : Number(input.productionDays),
      notes: input.notes || null,
    },
  });

  await prisma.sourcingRequest.update({
    where: { id: input.requestId },
    data: { status: "QUOTED", updatedAt: new Date() },
  });

  await audit(user.id, "sourcing.quote_added", "supplierQuote", quote.id, {
    requestId: input.requestId,
  });
  revalidatePath(`/sourcing/${input.requestId}`);
  redirect(`/sourcing/${input.requestId}`);
}

export async function selectSupplierQuote(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      requestId: idSchema,
      quoteId: idSchema,
    })
    .parse(formObject(formData));

  const quote = await prisma.supplierQuote.findFirst({
    where: { id: input.quoteId, requestId: input.requestId },
    select: { id: true },
  });
  if (!quote) throw new Error("Offerte niet gevonden");

  await prisma.$transaction([
    prisma.supplierQuote.updateMany({
      where: { requestId: input.requestId },
      data: { selected: false },
    }),
    prisma.supplierQuote.update({
      where: { id: quote.id },
      data: { selected: true },
    }),
    prisma.sourcingRequest.update({
      where: { id: input.requestId },
      data: { status: "SELECTED" },
    }),
  ]);

  await audit(user.id, "sourcing.quote_selected", "supplierQuote", input.quoteId, {
    requestId: input.requestId,
  });
  revalidatePath(`/sourcing/${input.requestId}`);
  redirect(`/sourcing/${input.requestId}`);
}
