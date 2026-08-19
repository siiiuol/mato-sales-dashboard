"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { generateDocumentFromTemplate, TemplateNotActiveError } from "./document-numbering";

/** Nooit door het formulier overschrijfbaar — worden door de generator zelf gezet. */
const SYSTEM_KEYS = new Set(["datum", "documentnummer"]);

const schema = z.object({
  customerId: idSchema,
  templateCode: z.string().trim().min(1),
});

/**
 * Genereert een document van eender welk actief sjabloon voor een klant.
 *
 * Het generieke tegenhanger van `generateContract`/`generateCustomerDocument`:
 * die twee kennen hun sjabloon en bouwen de context zelf op uit bekende
 * velden. Hier komt de context rechtstreeks uit het formulier — elk veld dat
 * met `field_` begint wordt een plaatshouder, klantvelden vooraf ingevuld
 * door `CustomerDocumentForm` maar hier gewoon tekst zoals al het andere.
 */
export async function generateGenericDocument(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const raw = formObject(formData);
  const input = schema.parse({
    customerId: raw.customerId,
    templateCode: raw.templateCode,
  });

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new Error("Klant niet gevonden");

  const template = await prisma.documentTemplate.findFirst({
    where: { code: input.templateCode, status: "MATO_APPROVED" },
    orderBy: { version: "desc" },
    select: { name: true },
  });
  if (!template) {
    throw new Error(`Er is geen actief sjabloon met code "${input.templateCode}".`);
  }

  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("field_") || typeof value !== "string") continue;
    const placeholder = key.slice("field_".length).toLowerCase();
    if (SYSTEM_KEYS.has(placeholder)) continue;
    const trimmed = value.trim();
    if (trimmed) context[placeholder] = trimmed;
  }

  let document;
  try {
    ({ document } = await generateDocumentFromTemplate({
      templateCode: input.templateCode,
      context,
      title: `${template.name} — ${customer.name}`,
      createdById: user.id,
      customerId: customer.id,
    }));
  } catch (err) {
    if (err instanceof TemplateNotActiveError) {
      throw new Error(err.message);
    }
    throw err;
  }

  await audit(user.id, "document.generated", "document", document.id, {
    number: document.number,
    customerId: customer.id,
    templateCode: input.templateCode,
  });

  revalidatePath(`/klanten/${customer.id}`);
  redirect(`/documenten/${document.id}`);
}
