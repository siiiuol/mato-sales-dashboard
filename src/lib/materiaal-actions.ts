"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { generateDocumentFromTemplate, TemplateNotActiveError } from "./document-numbering";
import { matoPdfByCode } from "./mato-pdf-templates";
import { PARTNER_TEMPLATES } from "./partner-templates";

const SYSTEM_KEYS = new Set(["datum", "documentnummer"]);

/**
 * Zorgt dat het PARTNER_* sjabloon bestaat en actief is (MATO_APPROVED).
 *
 * PDF-materiaal moet invulbaar zijn zonder eerst naar Instellingen te moeten;
 * concepten uit de seed worden hier één keer geactiveerd met audit.
 */
async function ensureActivePartnerTemplate(code: string, userId: string) {
  const meta = PARTNER_TEMPLATES.find((t) => t.code === code);
  if (!meta) {
    throw new Error(`Onbekend sjabloon: ${code}`);
  }

  let template = await prisma.documentTemplate.findFirst({
    where: { code, status: "MATO_APPROVED" },
    orderBy: { version: "desc" },
  });
  if (template) return template;

  const draft = await prisma.documentTemplate.findFirst({
    where: { code },
    orderBy: { version: "desc" },
  });

  if (draft) {
    await prisma.documentTemplate.update({
      where: { id: draft.id },
      data: {
        status: "MATO_APPROVED",
        approvedAt: new Date(),
        approvedById: userId,
        effectiveAt: draft.effectiveAt ?? new Date(),
      },
    });
    await audit(userId, "template.activated", "template", draft.id, { code });
    return prisma.documentTemplate.findUniqueOrThrow({ where: { id: draft.id } });
  }

  template = await prisma.documentTemplate.create({
    data: {
      code: meta.code,
      name: meta.name,
      category: meta.category,
      language: "nl",
      version: 1,
      status: "MATO_APPROVED",
      numberPrefix: meta.prefix,
      body: meta.body,
      outputFormats: "PDF",
      effectiveAt: new Date(),
      approvedAt: new Date(),
      approvedById: userId,
    },
  });
  await audit(userId, "template.created_approved", "template", template.id, {
    code,
  });
  return template;
}

/**
 * Vult een materiaal-sjabloon in en maakt een genummerd document.
 */
export async function fillMateriaalDocument(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const raw = formObject(formData);
  const input = z
    .object({
      templateCode: z.string().trim().min(1),
      leadId: z.string().optional(),
      titleExtra: z.string().trim().max(200).optional(),
    })
    .parse({
      templateCode: raw.templateCode,
      leadId: raw.leadId || undefined,
      titleExtra: raw.titleExtra || undefined,
    });

  const pdfMeta = matoPdfByCode(input.templateCode);
  if (!pdfMeta) {
    throw new Error("Dit sjabloon hoort niet bij het PDF-materiaal.");
  }

  const leadId =
    input.leadId && input.leadId !== ""
      ? idSchema.parse(input.leadId)
      : null;

  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true },
    });
    if (!lead) throw new Error("Lead niet gevonden");
  }

  await ensureActivePartnerTemplate(input.templateCode, user.id);

  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("field_") || typeof value !== "string") continue;
    const placeholder = key.slice("field_".length).toLowerCase();
    if (SYSTEM_KEYS.has(placeholder)) continue;
    const trimmed = value.trim();
    if (trimmed) context[placeholder] = trimmed;
  }

  const partnerName = context.klant_naam?.trim() || input.titleExtra?.trim() || "concept";

  let document;
  try {
    ({ document } = await generateDocumentFromTemplate({
      templateCode: input.templateCode,
      context,
      title: `${pdfMeta.title} — ${partnerName}`,
      createdById: user.id,
      leadId,
    }));
  } catch (err) {
    if (err instanceof TemplateNotActiveError) {
      throw new Error(err.message);
    }
    throw err;
  }

  await audit(user.id, "document.generated", "document", document.id, {
    number: document.number,
    templateCode: input.templateCode,
    source: "materiaal",
  });

  revalidatePath("/reclame/materiaal");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  redirect(`/documenten/${document.id}`);
}
