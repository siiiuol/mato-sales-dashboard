"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { runDetection } from "./detection";
import { FLANDERS_ZONES } from "./constants";
import type { DealStage, LeadStatus, ProductLine } from "./types";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { sendLearningOutcomeSafely } from "./learning";
import {
  callOutcomeSchema,
  dealStageSchema,
  formObject,
  idSchema,
  leadStatusSchema,
} from "./validation";

const optionalId = z.string().cuid().optional().or(z.literal(""));
const finiteMoney = z.coerce.number().finite().min(0).max(100_000_000);

async function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export async function scanZone(zone: string) {
  await requireUser(["admin", "sales", "reviewer"]);
  if (!FLANDERS_ZONES.includes(zone as (typeof FLANDERS_ZONES)[number])) {
    throw new Error("Invalid zone");
  }
  const settings = await getSettings();
  const result = await runDetection(prisma, zone, settings);
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/calls");
  return result;
}

export async function logCall(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const parsed = z.object({
    leadId: idSchema,
    outcome: callOutcomeSchema,
    note: z.string().trim().max(2000).optional(),
    callbackAt: z.string().optional(),
    nextLeadId: optionalId,
  }).parse(formObject(formData));
  const { leadId, outcome } = parsed;
  const note = parsed.note || null;
  const callbackAt = parsed.callbackAt || "";
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      doNotContact: true,
      complianceStatus: true,
      intelligenceEstablishmentId: true,
      intelligenceEnterpriseId: true,
      tier: true,
    },
  });
  if (!lead) throw new Error("Lead not found");
  if (lead.doNotContact || lead.complianceStatus === "BLOCKED") {
    throw new Error("Compliance block: outreach is not permitted");
  }

  const nextFollowUpAt =
    outcome === "CALLBACK" && callbackAt ? new Date(callbackAt) : null;

  let status: LeadStatus = "CONTACTED";
  if (outcome === "INTERESTED") status = "NEGOTIATION";
  if (outcome === "NOT_INTERESTED") status = "LOST";
  if (outcome === "CALLBACK" || outcome === "VOICEMAIL" || outcome === "NO_ANSWER") {
    status = "FOLLOW_UP";
  }
  if (outcome === "WRONG_NUMBER") status = "DO_NOT_CONTACT";

  const outreach = await prisma.outreachEvent.create({
    data: {
      leadId,
      type: "CALL",
      outcome,
      note,
      nextFollowUpAt: nextFollowUpAt ?? undefined,
      createdById: user.id,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      nextActionAt:
        nextFollowUpAt ??
        (status === "FOLLOW_UP" ? new Date(Date.now() + 86400000) : null),
      lastTouchedAt: new Date(),
    },
  });
  await audit(user.id, "call.logged", "lead", leadId, { outcome });
  if (lead.intelligenceEstablishmentId) {
    await sendLearningOutcomeSafely({
      idempotency_key: `outreach:${outreach.id}`,
      intelligence_establishment_id: lead.intelligenceEstablishmentId,
      enterprise_number: lead.intelligenceEnterpriseId,
      outcome_type: "outreach",
      outcome_value: outcome.toLowerCase(),
      occurred_at: outreach.createdAt.toISOString(),
      cohort: lead.tier,
    });
  }

  revalidatePath("/calls");
  revalidatePath("/leads");
  revalidatePath("/");
  redirect(parsed.nextLeadId ? `/calls?lead=${parsed.nextLeadId}` : "/calls");
}

export async function createLead(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    name: z.string().trim().min(1).max(300),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(150).optional(),
    province: z.string().trim().max(150).optional(),
    category: z.string().trim().max(150).optional(),
    phone: z.string().trim().max(100).optional(),
    email: z.string().email().optional().or(z.literal("")),
    website: z.string().url().optional().or(z.literal("")),
    score: z.coerce.number().int().min(0).max(100).default(50),
  }).parse(formObject(formData));

  const lead = await prisma.lead.create({
    data: {
      name: input.name,
      address: input.address || null,
      city: input.city || null,
      province: input.province || null,
      category: input.category || null,
      phone: input.phone || null,
      email: input.email || null,
      website: input.website || null,
      source: "manual",
      score: input.score,
      reason: "Manual entry",
      status: "TO_CALL",
      nextActionAt: new Date(),
    },
  });
  await audit(user.id, "lead.created", "lead", lead.id);

  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/");
}

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const user = await requireUser(["admin", "sales"]);
  const id = idSchema.parse(leadId);
  const nextStatus = leadStatusSchema.parse(status);
  await prisma.lead.update({ where: { id }, data: { status: nextStatus } });
  await audit(user.id, "lead.status_changed", "lead", id, { status: nextStatus });
  revalidatePath("/leads");
  revalidatePath("/calls");
}

export async function convertLeadToCustomer(leadId: string) {
  const user = await requireUser(["admin", "sales"]);
  leadId = idSchema.parse(leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const existing = await prisma.customer.findUnique({ where: { leadId } });
  if (existing) return existing.id;

  const customer = await prisma.customer.create({
    data: {
      name: lead.name,
      address: lead.address,
      city: lead.city,
      province: lead.province,
      phone: lead.phone,
      email: lead.email,
      website: lead.website,
      leadId: lead.id,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "WON" },
  });

  revalidatePath("/customers");
  revalidatePath("/leads");
  await audit(user.id, "lead.converted", "lead", leadId, { customerId: customer.id });
  return customer.id;
}

export async function createDeal(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    title: z.string().trim().min(1).max(300),
    leadId: optionalId,
    customerId: optionalId,
    productId: idSchema,
    qty: z.coerce.number().int().min(1).max(1000).default(1),
    expectedMachineCount: z.coerce.number().int().min(0).max(10000).default(1),
    recurringValue: finiteMoney.default(0),
    probability: z.coerce.number().int().min(0).max(100).default(25),
    nextStep: z.string().trim().max(1000).optional(),
  }).parse(formObject(formData));
  const { title, productId, qty } = input;
  const leadId = input.leadId || null;
  const customerId = input.customerId || null;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  const deal = await prisma.deal.create({
    data: {
      title,
      leadId,
      customerId,
      stage: "QUALIFIED",
      expectedMachineCount: input.expectedMachineCount,
      recurringValue: input.recurringValue,
      probability: input.probability,
      nextStep: input.nextStep || null,
      lastActivityAt: new Date(),
      lines: {
        create: [{ productId, qty: qty || 1, unitPrice: product.listPrice }],
      },
    },
  });
  await audit(user.id, "deal.created", "deal", deal.id);

  revalidatePath("/deals");
  revalidatePath("/");
}

export async function updateDealStage(dealId: string, stage: DealStage) {
  const user = await requireUser(["admin", "sales"]);
  dealId = idSchema.parse(dealId);
  stage = dealStageSchema.parse(stage);
  await prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findUnique({
      where: { id: dealId },
      include: { lines: true, lead: true },
    });
    if (!deal) throw new Error("Deal not found");
    if (deal.stage === stage) return;

    let customerId = deal.customerId;
    if (stage === "WON" && !customerId && deal.lead) {
      const customer = await tx.customer.upsert({
        where: { leadId: deal.lead.id },
        update: {},
        create: {
          name: deal.lead.name,
          address: deal.lead.address,
          city: deal.lead.city,
          province: deal.lead.province,
          phone: deal.lead.phone,
          email: deal.lead.email,
          website: deal.lead.website,
          leadId: deal.lead.id,
        },
      });
      customerId = customer.id;
      await tx.lead.update({
        where: { id: deal.lead.id },
        data: { status: "WON" },
      });
    }

    if (stage === "WON" && customerId) {
      for (const line of deal.lines) {
        await tx.purchase.upsert({
          where: { dealLineId: line.id },
          update: {},
          create: {
            dealLineId: line.id,
            customerId,
            productId: line.productId,
            qty: line.qty,
            unitPrice: line.unitPrice,
          },
        });
      }
    }

    await tx.deal.update({
      where: { id: dealId },
      data: {
        stage,
        customerId,
        wonAt: stage === "WON" ? deal.wonAt || new Date() : deal.wonAt,
        lastActivityAt: new Date(),
      },
    });
  });
  await audit(user.id, "deal.stage_changed", "deal", dealId, { stage });
  const learningDeal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { lead: true, lines: true },
  });
  if (learningDeal?.lead?.intelligenceEstablishmentId) {
    const revenue = learningDeal.lines.reduce(
      (sum, line) => sum + line.qty * line.unitPrice,
      0
    ) * (1 - learningDeal.discountPercent / 100);
    const closedAt = learningDeal.wonAt || learningDeal.updatedAt;
    await sendLearningOutcomeSafely({
      idempotency_key: `deal-stage:${learningDeal.id}:${stage}`,
      intelligence_establishment_id: learningDeal.lead.intelligenceEstablishmentId,
      enterprise_number: learningDeal.lead.intelligenceEnterpriseId,
      outcome_type: "deal",
      outcome_value: stage.toLowerCase(),
      machine_count: learningDeal.expectedMachineCount,
      revenue_eur: revenue,
      gross_margin_eur: learningDeal.grossMargin,
      sales_cycle_days: Math.max(
        0,
        (closedAt.getTime() - learningDeal.createdAt.getTime()) / 86_400_000
      ),
      occurred_at: closedAt.toISOString(),
      cohort: learningDeal.lead.tier,
    });
  }
  revalidatePath("/deals");
  revalidatePath("/customers");
  revalidatePath("/sales");
  revalidatePath("/");
}

export async function addDealLine(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    dealId: idSchema,
    productId: idSchema,
    qty: z.coerce.number().int().min(1).max(1000).default(1),
  }).parse(formObject(formData));
  const { dealId, productId, qty } = input;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!dealId || !product) throw new Error("Invalid line");

  await prisma.dealLine.create({
    data: {
      dealId,
      productId,
      qty: qty || 1,
      unitPrice: product.listPrice,
    },
  });
  await audit(user.id, "deal.line_added", "deal", dealId, { productId, qty });
  revalidatePath("/deals");
}

export async function upsertProduct(formData: FormData) {
  const user = await requireUser(["admin"]);
  const id = String(formData.get("id") ?? "");
  const data = {
    name: String(formData.get("name") ?? "").trim(),
    line: String(formData.get("line") ?? "MACHINE") as ProductLine,
    sku: String(formData.get("sku") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    specs: String(formData.get("specs") ?? "") || null,
    listPrice: Number(formData.get("listPrice") ?? 0),
    cost: Number(formData.get("cost") ?? 0),
    recurring: formData.get("recurring") === "on",
    active: formData.get("active") !== "off",
  };
  if (!data.name) throw new Error("Name required");

  if (id) {
    await prisma.product.update({ where: { id }, data });
  } else {
    await prisma.product.create({ data });
  }
  revalidatePath("/catalog");
  await audit(user.id, id ? "product.updated" : "product.created", "product", id || undefined);
}

export async function saveSettings(formData: FormData) {
  const user = await requireUser(["admin"]);
  const categories = String(formData.get("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const zones = formData.getAll("zones").map(String);

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {
      businessName: String(formData.get("businessName") ?? "MATO"),
      placesApiKey: String(formData.get("placesApiKey") ?? ""),
      detectionCategories: JSON.stringify(categories),
      enabledZones: JSON.stringify(zones.length ? zones : [...FLANDERS_ZONES]),
      exclusionRadiusKm: Number(formData.get("exclusionRadiusKm") ?? 0.5),
      accent: String(formData.get("accent") ?? "green"),
      pitchTemplates: String(formData.get("pitchTemplates") ?? "{}"),
    },
    create: {
      id: "default",
      businessName: String(formData.get("businessName") ?? "MATO"),
      placesApiKey: String(formData.get("placesApiKey") ?? ""),
      detectionCategories: JSON.stringify(categories),
      enabledZones: JSON.stringify(zones.length ? zones : [...FLANDERS_ZONES]),
      exclusionRadiusKm: Number(formData.get("exclusionRadiusKm") ?? 0.5),
      accent: String(formData.get("accent") ?? "green"),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  await audit(user.id, "settings.updated", "settings", "default");
}

export async function createFollowUp(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(2000).optional(),
    dueAt: z.string().min(1),
    leadId: optionalId,
    customerId: optionalId,
    dealId: optionalId,
    priority: z.coerce.number().int().min(0).max(100).default(50),
  }).parse(formObject(formData));
  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) throw new Error("Invalid due date");
  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description || null,
      dueAt,
      priority: input.priority,
      leadId: input.leadId || null,
      customerId: input.customerId || null,
      dealId: input.dealId || null,
      assignedToId: user.id,
    },
  });
  if (input.leadId) {
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { nextActionAt: dueAt },
    });
  }
  await audit(user.id, "task.created", "task", task.id);
  revalidatePath("/");
  revalidatePath("/leads");
}

export async function completeTask(taskId: string) {
  const user = await requireUser(["admin", "sales"]);
  taskId = idSchema.parse(taskId);
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date() },
  });
  await audit(user.id, "task.completed", "task", taskId);
  revalidatePath("/");
  revalidatePath("/leads");
}

export async function createMeeting(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    title: z.string().trim().min(1).max(300),
    startsAt: z.string().min(1),
    location: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
    leadId: optionalId,
    customerId: optionalId,
    dealId: optionalId,
  }).parse(formObject(formData));
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid meeting date");
  const meeting = await prisma.meeting.create({
    data: {
      title: input.title,
      startsAt,
      location: input.location || null,
      notes: input.notes || null,
      leadId: input.leadId || null,
      customerId: input.customerId || null,
      dealId: input.dealId || null,
    },
  });
  await audit(user.id, "meeting.created", "meeting", meeting.id);
  revalidatePath("/");
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
}

export async function setLeadCompliance(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    leadId: idSchema,
    complianceStatus: z.enum(["PENDING", "CLEARED", "BLOCKED"]),
    suppressionReason: z.string().trim().max(1000).optional(),
  }).parse(formObject(formData));
  const blocked = input.complianceStatus === "BLOCKED";
  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      complianceStatus: input.complianceStatus,
      doNotContact: blocked,
      suppressionReason: blocked ? input.suppressionReason || "Manual DNC" : null,
      suppressionCheckedAt: new Date(),
      ...(blocked ? { status: "DO_NOT_CONTACT", nextActionAt: null } : {}),
    },
  });
  await audit(user.id, "lead.compliance_changed", "lead", input.leadId, input);
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/calls");
}

export async function approveEmailDraft(draftId: string) {
  const user = await requireUser(["admin", "sales"]);
  draftId = idSchema.parse(draftId);
  const draft = await prisma.emailDraft.findUnique({
    where: { id: draftId },
    include: { lead: true },
  });
  if (!draft) throw new Error("Draft not found");
  if (draft.lead.doNotContact || draft.lead.complianceStatus !== "CLEARED") {
    throw new Error("Compliance must be cleared before approval");
  }
  await prisma.emailDraft.update({
    where: { id: draftId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  await audit(user.id, "email.approved", "email_draft", draftId);
  revalidatePath("/");
  revalidatePath(`/leads/${draft.leadId}`);
}

export async function updateDealCommercials(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    dealId: idSchema,
    expectedMachineCount: z.coerce.number().int().min(0).max(10000),
    recurringValue: finiteMoney,
    probability: z.coerce.number().int().min(0).max(100),
    grossMargin: finiteMoney.optional().or(z.literal("")),
    nextStep: z.string().trim().max(1000).optional(),
    lossReason: z.string().trim().max(1000).optional(),
    expectedCloseAt: z.string().optional(),
  }).parse(formObject(formData));
  const expectedCloseAt = input.expectedCloseAt
    ? new Date(input.expectedCloseAt)
    : null;
  await prisma.deal.update({
    where: { id: input.dealId },
    data: {
      expectedMachineCount: input.expectedMachineCount,
      recurringValue: input.recurringValue,
      probability: input.probability,
      grossMargin: input.grossMargin === "" ? null : input.grossMargin,
      nextStep: input.nextStep || null,
      lossReason: input.lossReason || null,
      expectedCloseAt,
      lastActivityAt: new Date(),
    },
  });
  await audit(user.id, "deal.commercials_updated", "deal", input.dealId);
  revalidatePath("/deals");
}

export async function createQuote(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    dealId: idSchema,
    validUntil: z.string().optional(),
  }).parse(formObject(formData));
  const deal = await prisma.deal.findUnique({
    where: { id: input.dealId },
    include: { lines: { include: { product: true } } },
  });
  if (!deal) throw new Error("Deal not found");
  const quote = await prisma.quote.create({
    data: {
      number: `Q-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`,
      dealId: deal.id,
      leadId: deal.leadId,
      customerId: deal.customerId,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      discountPercent: deal.discountPercent,
      lines: {
        create: deal.lines.map((line) => ({
          description: line.product.name,
          sku: line.product.sku,
          qty: line.qty,
          unitPrice: line.unitPrice,
          unitCost: line.product.cost,
        })),
      },
    },
  });
  await audit(user.id, "quote.created", "quote", quote.id, { dealId: deal.id });
  revalidatePath("/quotes");
  revalidatePath("/deals");
}

export async function updateQuoteStatus(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    quoteId: idSchema,
    status: z.enum(["DRAFT", "REVIEW", "APPROVED", "SENT", "ACCEPTED", "EXPIRED"]),
  }).parse(formObject(formData));
  await prisma.quote.update({
    where: { id: input.quoteId },
    data: { status: input.status },
  });
  await audit(user.id, "quote.status_changed", "quote", input.quoteId, input);
  revalidatePath("/quotes");
}

export async function deleteQuote(quoteId: string) {
  const user = await requireUser(["admin"]);
  quoteId = idSchema.parse(quoteId);
  await prisma.quote.delete({ where: { id: quoteId } });
  await audit(user.id, "quote.deleted", "quote", quoteId);
  revalidatePath("/quotes");
}
