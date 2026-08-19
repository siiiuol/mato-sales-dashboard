"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { DOCUMENT_CATEGORIES } from "./constants";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_]+$/, "Alleen hoofdletters, cijfers en underscore");

const createSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1).max(150),
  category: z.enum(DOCUMENT_CATEGORIES),
  numberPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]+$/, "Alleen hoofdletters, cijfers en streepjes"),
  body: z.string().trim().min(1),
});

/**
 * Maakt een nieuw sjabloon aan, als concept — nog geen numberPrefix in gebruik
 * tot iemand het bewust activeert.
 */
export async function createTemplate(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = createSchema.parse(formObject(formData));

  const existing = await prisma.documentTemplate.findFirst({
    where: { code: input.code },
  });
  if (existing) {
    throw new Error(`Code "${input.code}" bestaat al — kies een andere, of maak een nieuwe versie.`);
  }

  const template = await prisma.documentTemplate.create({
    data: {
      code: input.code,
      name: input.name,
      category: input.category,
      numberPrefix: input.numberPrefix,
      body: input.body,
      language: "nl",
      version: 1,
      status: "DRAFT",
      ownerId: user.id,
    },
  });

  await audit(user.id, "template.created", "template", template.id, { code: input.code });
  revalidatePath("/settings/sjablonen");
  redirect(`/settings/sjablonen/${template.id}`);
}

const updateSchema = z.object({
  templateId: idSchema,
  name: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1),
});

/** Bewerkt een sjabloon in-place — alleen zolang het nog een DRAFT is. */
export async function updateTemplateDraft(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = updateSchema.parse(formObject(formData));

  const template = await prisma.documentTemplate.findUnique({
    where: { id: input.templateId },
    select: { status: true },
  });
  if (!template) throw new Error("Sjabloon niet gevonden");
  if (template.status !== "DRAFT") {
    throw new Error("Alleen een concept is nog te bewerken — maak een nieuwe versie voor verdere wijzigingen.");
  }

  await prisma.documentTemplate.update({
    where: { id: input.templateId },
    data: { name: input.name, body: input.body },
  });

  await audit(user.id, "template.updated", "template", input.templateId);
  revalidatePath(`/settings/sjablonen/${input.templateId}`);
}

/**
 * Maakt een nieuwe versie op basis van een bestaand sjabloon — copy, geen
 * wijziging aan het origineel. Een geactiveerde versie mag nooit met terug-
 * werkende kracht veranderen; wie iets wil aanpassen begint een nieuwe versie.
 */
export async function createTemplateVersion(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z.object({ templateId: idSchema }).parse(formObject(formData));

  const source = await prisma.documentTemplate.findUnique({
    where: { id: input.templateId },
  });
  if (!source) throw new Error("Sjabloon niet gevonden");

  const latest = await prisma.documentTemplate.findFirst({
    where: { code: source.code },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = await prisma.documentTemplate.create({
    data: {
      code: source.code,
      name: source.name,
      category: source.category,
      numberPrefix: source.numberPrefix,
      body: source.body,
      language: source.language,
      version: (latest?.version ?? source.version) + 1,
      status: "DRAFT",
      ownerId: user.id,
    },
  });

  await audit(user.id, "template.version_created", "template", version.id, {
    code: source.code,
    versie: version.version,
  });
  revalidatePath("/settings/sjablonen");
  redirect(`/settings/sjablonen/${version.id}`);
}

/**
 * Activeert deze versie — supersedet atomisch elke andere actieve versie van
 * dezelfde code, zelfde claim-patroon als `claims.ts`: twee beheerders die
 * tegelijk activeren mogen niet allebei winnen.
 */
export async function setTemplateActive(formData: FormData) {
  const user = await requireUser(["admin"]);
  const input = z.object({ templateId: idSchema }).parse(formObject(formData));

  const template = await prisma.documentTemplate.findUnique({
    where: { id: input.templateId },
    select: { code: true },
  });
  if (!template) throw new Error("Sjabloon niet gevonden");

  await prisma.documentTemplate.updateMany({
    where: { code: template.code, status: "MATO_APPROVED" },
    data: { status: "SUPERSEDED" },
  });
  await prisma.documentTemplate.update({
    where: { id: input.templateId },
    data: {
      status: "MATO_APPROVED",
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });

  await audit(user.id, "template.activated", "template", input.templateId, {
    code: template.code,
  });
  revalidatePath("/settings/sjablonen");
  revalidatePath(`/settings/sjablonen/${input.templateId}`);
}
