"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { prisma } from "./db";
import { allocateNumber } from "./document-numbering";
import { formObject, idSchema } from "./validation";

const ORDER_STATUSES = [
  "DRAFT",
  "SENT",
  "CONFIRMED",
  "SHIPPED",
  "RECEIVED",
  "CANCELLED",
] as const;

const NEXT_STATUS: Record<string, string | null> = {
  DRAFT: "SENT",
  SENT: "CONFIRMED",
  CONFIRMED: "SHIPPED",
  SHIPPED: "RECEIVED",
  RECEIVED: null,
  CANCELLED: null,
};

/**
 * Maakt een leveranciersbestelling vanuit de gekozen offerte van een
 * sourcing-aanvraag (Kaigo / packaging handoff).
 */
export async function createOrderFromSourcing(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      requestId: idSchema,
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
      expectedAt: z.string().optional().or(z.literal("")),
    })
    .parse(formObject(formData));

  const request = await prisma.sourcingRequest.findUnique({
    where: { id: input.requestId },
    include: {
      quotes: {
        where: { selected: true },
        take: 1,
        include: { supplier: { select: { id: true, name: true } } },
      },
    },
  });
  if (!request) throw new Error("Aanvraag niet gevonden");
  const quote = request.quotes[0];
  if (!quote) throw new Error("Kies eerst een offerte");

  const existing = await prisma.supplierOrder.findFirst({
    where: { sourcingRequestId: request.id, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (existing) {
    redirect(`/sourcing/orders/${existing.id}`);
  }

  const year = new Date().getUTCFullYear();
  const code = await allocateNumber("PO", year);
  const expectedAt = input.expectedAt ? new Date(input.expectedAt) : null;

  const order = await prisma.supplierOrder.create({
    data: {
      code,
      title: `${request.title} — ${quote.supplier.name}`,
      status: "DRAFT",
      supplierId: quote.supplierId,
      dealId: request.dealId,
      customerId: request.customerId,
      sourcingRequestId: request.id,
      notes: input.notes || null,
      expectedAt:
        expectedAt && !Number.isNaN(expectedAt.getTime()) ? expectedAt : null,
      createdById: user.id,
    },
  });

  await prisma.sourcingRequest.update({
    where: { id: request.id },
    data: { status: "ORDERED" },
  });

  await audit(user.id, "supplier_order.created", "supplierOrder", order.id, {
    code: order.code,
    requestId: request.id,
  });

  revalidatePath(`/sourcing/${request.id}`);
  revalidatePath("/sourcing/orders");
  redirect(`/sourcing/orders/${order.id}`);
}

/**
 * Maakt een bestelling vanuit een gewonnen deal (Kaigo-handoff).
 */
export async function createOrderFromDeal(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      dealId: idSchema,
      supplierId: idSchema,
      title: z.string().trim().min(2).max(200),
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
      expectedAt: z.string().optional().or(z.literal("")),
    })
    .parse(formObject(formData));

  const deal = await prisma.deal.findUnique({
    where: { id: input.dealId },
    select: { id: true, title: true, customerId: true, stage: true },
  });
  if (!deal) throw new Error("Deal niet gevonden");

  const year = new Date().getUTCFullYear();
  const code = await allocateNumber("PO", year);
  const expectedAt = input.expectedAt ? new Date(input.expectedAt) : null;

  const order = await prisma.supplierOrder.create({
    data: {
      code,
      title: input.title,
      status: "DRAFT",
      supplierId: input.supplierId,
      dealId: deal.id,
      customerId: deal.customerId,
      notes: input.notes || null,
      expectedAt:
        expectedAt && !Number.isNaN(expectedAt.getTime()) ? expectedAt : null,
      createdById: user.id,
    },
  });

  await audit(user.id, "supplier_order.created", "supplierOrder", order.id, {
    code: order.code,
    dealId: deal.id,
  });

  revalidatePath(`/sourcing/orders`);
  revalidatePath(`/leads`);
  redirect(`/sourcing/orders/${order.id}`);
}

export async function advanceSupplierOrder(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      orderId: idSchema,
      action: z.enum(["next", "cancel"]),
    })
    .parse(formObject(formData));

  const order = await prisma.supplierOrder.findUnique({
    where: { id: input.orderId },
    select: { id: true, status: true },
  });
  if (!order) throw new Error("Bestelling niet gevonden");

  if (input.action === "cancel") {
    await prisma.supplierOrder.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
    await audit(user.id, "supplier_order.cancelled", "supplierOrder", order.id, {});
    revalidatePath(`/sourcing/orders/${order.id}`);
    revalidatePath("/sourcing/orders");
    redirect(`/sourcing/orders/${order.id}`);
  }

  const next = NEXT_STATUS[order.status];
  if (!next || !(ORDER_STATUSES as readonly string[]).includes(next)) {
    throw new Error("Deze bestelling kan niet verder");
  }

  const now = new Date();
  await prisma.supplierOrder.update({
    where: { id: order.id },
    data: {
      status: next,
      orderedAt: next === "SENT" ? now : undefined,
      receivedAt: next === "RECEIVED" ? now : undefined,
    },
  });

  await audit(user.id, "supplier_order.advanced", "supplierOrder", order.id, {
    from: order.status,
    to: next,
  });
  revalidatePath(`/sourcing/orders/${order.id}`);
  revalidatePath("/sourcing/orders");
  redirect(`/sourcing/orders/${order.id}`);
}
