"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { documentDate } from "./documents";
import { generateDocumentFromTemplate, TemplateNotActiveError } from "./document-numbering";
import { formObject, idSchema } from "./validation";

const CUSTOMER_DOCUMENT_CODE = "OPSTART";

const schema = z.object({
  customerId: idSchema,
  machinePlacementId: idSchema,
});

/**
 * Genereert een opstartbevestiging voor een klant — welk toestel, sinds
 * wanneer, op welk adres. Het concrete tweede gebruik van de generieke
 * sjabloonstroom, rechtstreeks gekoppeld aan de klantfiche.
 */
export async function generateCustomerDocument(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = schema.parse(formObject(formData));

  const [customer, placement] = await Promise.all([
    prisma.customer.findUnique({ where: { id: input.customerId } }),
    prisma.machinePlacement.findUnique({
      where: { id: input.machinePlacementId },
      include: { product: { select: { name: true } } },
    }),
  ]);
  if (!customer) throw new Error("Klant niet gevonden");
  if (!placement || placement.customerId !== customer.id) {
    throw new Error("Automaat niet gevonden bij deze klant");
  }

  const context: Record<string, string> = {
    klant_naam: customer.name,
    klant_adres: customer.address ?? "",
    klant_gemeente: [customer.city, customer.province].filter(Boolean).join(", "),
    automaat_model: placement.model || placement.product?.name || "",
    plaatsingsadres: [placement.address, placement.city].filter(Boolean).join(", "),
    sinds: documentDate(placement.placedAt),
  };

  let document;
  try {
    ({ document } = await generateDocumentFromTemplate({
      templateCode: CUSTOMER_DOCUMENT_CODE,
      context,
      title: `Opstartbevestiging ${customer.name}`,
      createdById: user.id,
      customerId: customer.id,
    }));
  } catch (err) {
    if (err instanceof TemplateNotActiveError) {
      throw new Error(
        'Er is nog geen actief opstartsjabloon (code "OPSTART") — maak er één aan bij Instellingen → Documentsjablonen.'
      );
    }
    throw err;
  }

  await audit(user.id, "document.generated", "document", document.id, {
    number: document.number,
    customerId: customer.id,
  });

  revalidatePath(`/klanten/${customer.id}`);
  redirect(`/documenten/${document.id}`);
}
