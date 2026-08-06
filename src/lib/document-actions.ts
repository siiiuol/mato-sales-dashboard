"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import {
  CLAUSE_CATEGORIES,
  CLAUSE_STATUSES,
  DOCUMENT_CATEGORIES,
  TEMPLATE_STATUSES,
} from "./constants";
import {
  checkTemplateUsable,
  formatDocumentNumber,
  hasBlockers,
  needsExternalReview,
  renderTemplate,
  sequenceId,
  validateDocument,
  type ValidationIssue,
} from "./documents";

const optionalText = (max = 5000) =>
  z.string().trim().max(max).optional().transform((v) => v || null);
const optionalId = z.string().cuid().optional().or(z.literal("")).transform((v) => v || null);
const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

/* ---------------------------------------------------------------- templates */

export async function createTemplate(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z
    .object({
      code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
      name: z.string().trim().min(1).max(200),
      category: z.enum(DOCUMENT_CATEGORIES).optional(),
      language: z.string().trim().max(10).optional(),
      numberPrefix: z.string().trim().min(1).max(10),
      body: z.string().max(50_000).optional(),
      requiredFields: optionalText(1000),
      effectiveAt: optionalDate,
      reviewAt: optionalDate,
    })
    .parse(formObject(formData));

  const last = await prisma.documentTemplate.findFirst({
    where: { code: input.code },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const template = await prisma.documentTemplate.create({
    data: {
      code: input.code.toUpperCase(),
      name: input.name,
      category: input.category ?? "SALES",
      language: input.language || "nl",
      version,
      numberPrefix: input.numberPrefix.toUpperCase(),
      body: input.body ?? "",
      requiredFields: input.requiredFields,
      effectiveAt: input.effectiveAt,
      reviewAt: input.reviewAt,
      ownerId: user.id,
      status: "DRAFT",
    },
  });

  // A newer version supersedes the previous one (§40.1).
  if (last) {
    await prisma.documentTemplate.updateMany({
      where: { code: input.code.toUpperCase(), version: { lt: version }, status: { notIn: ["BLOCKED"] } },
      data: { status: "SUPERSEDED" },
    });
  }

  await audit(user.id, "template.created", "document_template", template.id, { version });
  revalidatePath("/documents/templates");
  redirect("/documents/templates");
}

export async function setTemplateStatus(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z
    .object({
      templateId: idSchema,
      status: z.enum(TEMPLATE_STATUSES),
      approvalSource: optionalText(200),
    })
    .parse(formObject(formData));

  const approving = ["MATO_APPROVED", "ACCOUNTANT_APPROVED", "LEGAL_APPROVED"].includes(
    input.status
  );
  if (approving && !input.approvalSource) {
    throw new Error("Record who approved this template before marking it approved");
  }

  await prisma.documentTemplate.update({
    where: { id: input.templateId },
    data: {
      status: input.status,
      approvalSource: input.approvalSource,
      approvedById: approving ? user.id : null,
      approvedAt: approving ? new Date() : null,
    },
  });
  await audit(user.id, "template.status", "document_template", input.templateId, {
    status: input.status,
    source: input.approvalSource,
  });
  revalidatePath("/documents/templates");
}

/* ------------------------------------------------------------------ clauses */

export async function createClause(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z
    .object({
      code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
      title: z.string().trim().min(1).max(200),
      category: z.enum(CLAUSE_CATEGORIES).optional(),
      textNl: z.string().max(20_000).optional(),
      textFr: z.string().max(20_000).optional(),
      textEn: z.string().max(20_000).optional(),
      mandatory: z.string().optional(),
      riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      reviewer: optionalText(200),
      explanation: optionalText(2000),
      reviewAt: optionalDate,
    })
    .parse(formObject(formData));

  const last = await prisma.clause.findFirst({
    where: { code: input.code.toUpperCase() },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const clause = await prisma.clause.create({
    data: {
      code: input.code.toUpperCase(),
      title: input.title,
      category: input.category ?? "GENERAL",
      textNl: input.textNl ?? "",
      textFr: input.textFr ?? "",
      textEn: input.textEn ?? "",
      mandatory: input.mandatory === "on",
      riskLevel: input.riskLevel ?? "MEDIUM",
      reviewer: input.reviewer,
      explanation: input.explanation,
      reviewAt: input.reviewAt,
      version,
      status: "DRAFT",
    },
  });
  await audit(user.id, "clause.created", "clause", clause.id, { version });
  revalidatePath("/documents/clauses");
}

export async function setClauseStatus(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z
    .object({
      clauseId: idSchema,
      status: z.enum(CLAUSE_STATUSES),
      reviewer: optionalText(200),
    })
    .parse(formObject(formData));

  const approving = ["MATO_APPROVED", "ACCOUNTANT_APPROVED", "LEGAL_APPROVED"].includes(
    input.status
  );
  if (approving && !input.reviewer) {
    throw new Error("Record who reviewed this clause before approving it");
  }

  const before = await prisma.clause.findUnique({
    where: { id: input.clauseId },
    select: { status: true },
  });
  await prisma.clause.update({
    where: { id: input.clauseId },
    data: {
      status: input.status,
      reviewer: input.reviewer,
      effectiveAt: approving ? new Date() : null,
    },
  });
  await audit(user.id, "clause.status", "clause", input.clauseId, {
    from: before?.status,
    to: input.status,
    reviewer: input.reviewer,
  });
  revalidatePath("/documents/clauses");
}

/* ---------------------------------------------------------------- numbering */

/**
 * Reserves the next number for a prefix (§43). The counter only ever
 * increments, so a number is never reused even if the document is deleted.
 */
async function reserveNumber(prefix: string) {
  const year = new Date().getFullYear();
  const id = sequenceId(prefix, year);
  const seq = await prisma.documentSequence.upsert({
    where: { id },
    create: { id, prefix: prefix.toUpperCase(), year, counter: 1 },
    update: { counter: { increment: 1 } },
    select: { counter: true },
  });
  return formatDocumentNumber(prefix, year, seq.counter);
}

/* --------------------------------------------------------------- generation */

function buildContext(entities: {
  customer?: { name: string; address: string | null; city: string | null; email: string | null; phone: string | null } | null;
  supplier?: { name: string; country: string; email: string | null } | null;
  lead?: { name: string; city: string | null; phone: string | null } | null;
}) {
  const today = new Date();
  return {
    today: today.toLocaleDateString("nl-BE"),
    year: String(today.getFullYear()),
    customer: entities.customer
      ? {
          name: entities.customer.name,
          address: entities.customer.address ?? "",
          city: entities.customer.city ?? "",
          email: entities.customer.email ?? "",
          phone: entities.customer.phone ?? "",
        }
      : undefined,
    supplier: entities.supplier
      ? {
          name: entities.supplier.name,
          country: entities.supplier.country,
          email: entities.supplier.email ?? "",
        }
      : undefined,
    lead: entities.lead
      ? {
          name: entities.lead.name,
          city: entities.lead.city ?? "",
          phone: entities.lead.phone ?? "",
        }
      : undefined,
  };
}

export async function generateDocument(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      templateId: idSchema,
      title: optionalText(300),
      customerId: optionalId,
      supplierId: optionalId,
      leadId: optionalId,
      dealId: optionalId,
      sourcingRequestId: optionalId,
    })
    .parse(formObject(formData));

  // A <select multiple> sends one entry per selection, so read them all rather
  // than letting formObject collapse to the last value.
  const clauseIds = z
    .array(z.string().cuid())
    .parse(formData.getAll("clauseIds").filter((v) => typeof v === "string" && v !== ""));

  const template = await prisma.documentTemplate.findUnique({
    where: { id: input.templateId },
  });
  if (!template) throw new Error("Template not found");

  // §40.1 — refuse before doing any work.
  const usable = checkTemplateUsable(template);
  if (!usable.usable) {
    throw new Error(`Cannot generate: ${usable.reason}`);
  }

  const [customer, supplier, lead] = await Promise.all([
    input.customerId
      ? prisma.customer.findUnique({
          where: { id: input.customerId },
          select: { name: true, address: true, city: true, email: true, phone: true },
        })
      : null,
    input.supplierId
      ? prisma.supplier.findUnique({
          where: { id: input.supplierId },
          select: { name: true, country: true, email: true },
        })
      : null,
    input.leadId
      ? prisma.lead.findUnique({
          where: { id: input.leadId },
          select: { name: true, city: true, phone: true },
        })
      : null,
  ]);

  const context = buildContext({ customer, supplier, lead });
  const { body, missing } = renderTemplate(template.body, context);

  const clauses = clauseIds.length
    ? await prisma.clause.findMany({ where: { id: { in: clauseIds } } })
    : [];

  const lang = template.language.toLowerCase();
  const clauseText = (c: (typeof clauses)[number]) =>
    lang === "fr" ? c.textFr : lang === "en" ? c.textEn : c.textNl;

  const requiredFields = (template.requiredFields ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const issues: ValidationIssue[] = validateDocument({
    template,
    requiredFields,
    context,
    missingTokens: missing,
    clauses: clauses.map((c) => ({
      code: c.code,
      status: c.status,
      mandatory: c.mandatory,
      text: clauseText(c),
    })),
  });

  const review = needsExternalReview({
    clauses: clauses.map((c) => ({ riskLevel: c.riskLevel })),
    templateStatus: template.status,
  });

  const number = await reserveNumber(template.numberPrefix);

  const doc = await prisma.generatedDocument.create({
    data: {
      number,
      title: input.title || `${template.name} · ${customer?.name ?? supplier?.name ?? lead?.name ?? "internal"}`,
      templateId: template.id,
      templateCode: template.code,
      templateVersion: template.version,
      language: template.language,
      status: hasBlockers(issues) ? "DRAFT" : "VALIDATED",
      body,
      contextJson: JSON.stringify(context),
      validationJson: JSON.stringify(issues),
      requiresExtReview: review.required,
      extReviewReason: review.reason ?? null,
      customerId: input.customerId,
      supplierId: input.supplierId,
      leadId: input.leadId,
      dealId: input.dealId,
      sourcingRequestId: input.sourcingRequestId,
      createdById: user.id,
      clauses: {
        create: clauses.map((c, i) => ({
          clauseId: c.id,
          clauseCode: c.code,
          clauseVersion: c.version,
          orderIndex: i,
          textSnapshot: clauseText(c),
        })),
      },
    },
  });

  await audit(user.id, "document.generated", "generated_document", doc.id, {
    number,
    template: `${template.code} v${template.version}`,
    blockers: issues.filter((i) => i.severity === "BLOCKER").length,
  });
  revalidatePath("/documents");
  redirect(`/documents/${doc.id}`);
}

/** §38.12 — approving locks the document; §42 — blockers prevent approval. */
export async function approveDocument(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z.object({ documentId: idSchema }).parse(formObject(formData));

  const doc = await prisma.generatedDocument.findUnique({
    where: { id: input.documentId },
    select: { validationJson: true, lockedAt: true, requiresExtReview: true },
  });
  if (!doc) throw new Error("Document not found");
  if (doc.lockedAt) throw new Error("Document is already locked");

  const issues: ValidationIssue[] = doc.validationJson
    ? JSON.parse(doc.validationJson)
    : [];
  if (hasBlockers(issues)) {
    throw new Error(
      "Validation blockers must be resolved before approval — regenerate after fixing the data"
    );
  }

  await prisma.generatedDocument.update({
    where: { id: input.documentId },
    data: {
      status: "APPROVED",
      approvedById: user.id,
      approvedAt: new Date(),
      lockedAt: new Date(),
    },
  });
  await audit(user.id, "document.approved", "generated_document", input.documentId, {
    requiresExtReview: doc.requiresExtReview,
  });
  revalidatePath(`/documents/${input.documentId}`);
  revalidatePath("/documents");
}

export async function recordDocumentSignature(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      documentId: idSchema,
      signerName: z.string().trim().min(1).max(200),
      signedAt: optionalDate,
    })
    .parse(formObject(formData));

  const doc = await prisma.generatedDocument.findUnique({
    where: { id: input.documentId },
    select: { status: true },
  });
  if (!doc) throw new Error("Document not found");
  if (!["APPROVED", "SENT"].includes(doc.status)) {
    throw new Error("Only an approved document can be recorded as signed");
  }

  await prisma.generatedDocument.update({
    where: { id: input.documentId },
    data: {
      status: "SIGNED",
      signerName: input.signerName,
      signedAt: input.signedAt ?? new Date(),
    },
  });
  await audit(user.id, "document.signed", "generated_document", input.documentId, {
    signer: input.signerName,
  });
  revalidatePath(`/documents/${input.documentId}`);
  revalidatePath("/documents");
}

export async function markDocumentSent(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({ documentId: idSchema }).parse(formObject(formData));

  const doc = await prisma.generatedDocument.findUnique({
    where: { id: input.documentId },
    select: { status: true },
  });
  if (doc?.status !== "APPROVED") {
    throw new Error("Only an approved document can be marked as sent");
  }

  await prisma.generatedDocument.update({
    where: { id: input.documentId },
    data: { status: "SENT", sentAt: new Date() },
  });
  await audit(user.id, "document.sent", "generated_document", input.documentId);
  revalidatePath(`/documents/${input.documentId}`);
}
