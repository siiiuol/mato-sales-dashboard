"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import {
  documentAmount,
  documentDate,
  fillTemplate,
  formatDocumentNumber,
  missingPlaceholders,
  priceBreakdown,
  sequenceId,
} from "./documents";
import {
  CONTRACT_CODE,
  CONTRACT_DEFAULTS,
  CONTRACT_PREFIX,
} from "./contract-template";
import { formObject, idSchema } from "./validation";

/**
 * Geeft het volgende documentnummer uit.
 *
 * De teller loopt alleen omhoog en wordt met één `upsert` opgehoogd, zodat twee
 * gelijktijdige aanvragen niet hetzelfde nummer kunnen krijgen. Een nummer dat
 * twee keer bestaat is in de boekhouding een probleem dat pas maanden later
 * opvalt.
 */
async function allocateNumber(prefix: string, year: number): Promise<string> {
  const sequence = await prisma.documentSequence.upsert({
    where: { id: sequenceId(prefix, year) },
    create: { id: sequenceId(prefix, year), prefix, year, counter: 1 },
    update: { counter: { increment: 1 } },
  });
  return formatDocumentNumber(prefix, year, sequence.counter);
}

const generateSchema = z.object({
  leadId: idSchema,
  productId: z.string().cuid(),
  price: z.coerce.number().min(0).max(10_000_000),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  note: z.string().trim().max(500).optional(),
});

/**
 * Maakt een ingevuld contract voor deze lead.
 *
 * De naam van de medewerker staat er met opzet in: dat maakt zichtbaar wie de
 * verkoop deed, en het is hetzelfde gegeven waar de commissie op gerekend
 * wordt.
 */
export async function generateContract(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = generateSchema.parse(formObject(formData));

  const [lead, product, template, settings] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: input.leadId },
      include: { customer: true, owner: { select: { id: true, name: true } } },
    }),
    prisma.product.findUnique({ where: { id: input.productId } }),
    prisma.documentTemplate.findFirst({
      where: { code: CONTRACT_CODE },
      orderBy: { version: "desc" },
    }),
    prisma.appSettings.findUnique({ where: { id: "default" } }),
  ]);

  if (!lead) throw new Error("Lead niet gevonden");
  if (!product) throw new Error("Product niet gevonden");
  if (!template) {
    throw new Error(
      "Er is nog geen contractsjabloon. Draai `npm run db:seed` om het aan te maken."
    );
  }

  // Alleen de eigenaar maakt het contract. Anders zet iemand anders zijn naam
  // onder een verkoop die niet van hem is, en dat is precies het gegeven waar
  // de commissie op rust.
  if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
    throw new Error(
      `Deze lead staat op naam van ${lead.owner?.name ?? "een collega"}`
    );
  }

  const now = new Date();
  const total = input.price * input.quantity;
  const { net, vat, gross } = priceBreakdown(total);
  const number = await allocateNumber(CONTRACT_PREFIX, now.getFullYear());

  const context: Record<string, string> = {
    ...CONTRACT_DEFAULTS,
    verkoper_naam: settings?.businessName || CONTRACT_DEFAULTS.verkoper_naam,
    verkoper_medewerker: user.name,
    documentnummer: number,
    datum: documentDate(now),
    plaats: lead.city ?? "",
    klant_naam: lead.customer?.name ?? lead.name,
    klant_adres: lead.address ?? "",
    klant_gemeente: [lead.city, lead.province].filter(Boolean).join(", "),
    klant_telefoon: lead.phone ?? "",
    artikel_naam: product.name,
    artikel_omschrijving: [product.description, product.specs]
      .filter(Boolean)
      .join(" · "),
    aantal: String(input.quantity),
    prijs_excl: documentAmount(net),
    btw_bedrag: documentAmount(vat),
    prijs_incl: documentAmount(gross),
    leveringsadres: [lead.address, lead.city].filter(Boolean).join(", "),
    ...(input.note ? { betalingsvoorwaarden: input.note } : {}),
  };

  const body = fillTemplate(template.body, context);
  const missing = missingPlaceholders(body);

  const document = await prisma.generatedDocument.create({
    data: {
      number,
      title: `Verkoopovereenkomst ${lead.customer?.name ?? lead.name}`,
      templateId: template.id,
      templateCode: template.code,
      templateVersion: template.version,
      language: "nl",
      // Ontbrekende velden houden het document in concept. Een contract met
      // {{klant_btw}} er nog in hoort niet als klaar te boek te staan.
      status: missing.length ? "DRAFT" : "READY",
      body,
      contextJson: JSON.stringify(context),
      validationJson: JSON.stringify({ missing }),
      leadId: lead.id,
      customerId: lead.customer?.id ?? null,
      createdById: user.id,
    },
  });

  await audit(user.id, "document.generated", "document", document.id, {
    number,
    leadId: lead.id,
    product: product.name,
    total: gross,
  });

  revalidatePath(`/leads/${lead.id}`);
  redirect(`/documenten/${document.id}`);
}

/** Legt vast dat de klant getekend heeft. */
export async function markDocumentSigned(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({ documentId: idSchema, signerName: z.string().trim().min(2).max(200) })
    .parse(formObject(formData));

  const now = new Date();
  await prisma.generatedDocument.update({
    where: { id: input.documentId },
    data: {
      status: "SIGNED",
      signedAt: now,
      signerName: input.signerName,
      // Vanaf hier ligt de tekst vast. Een getekend document dat nog verandert
      // is geen bewijs meer van wat er afgesproken is.
      lockedAt: now,
    },
  });

  await audit(user.id, "document.signed", "document", input.documentId, {
    signer: input.signerName,
  });
  revalidatePath(`/documenten/${input.documentId}`);
}
