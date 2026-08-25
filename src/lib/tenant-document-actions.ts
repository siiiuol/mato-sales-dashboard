"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { prisma } from "./db";
import {
  generateDocumentFromTemplate,
  TemplateNotActiveError,
} from "./document-numbering";
import { formObject, idSchema } from "./validation";

export async function generateTenantDocument(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      customerId: idSchema,
      placementId: idSchema,
      templateCode: z.string().trim().min(1).max(100),
    })
    .parse(formObject(formData));

  const tenant = await prisma.customer.findFirst({
    where: { id: input.customerId, kind: "SHOP_TENANT" },
    include: {
      machinePlacements: {
        where: { id: input.placementId, site: "SHOP_DIKSMUIDE" },
        include: { product: { select: { name: true } } },
      },
    },
  });
  if (!tenant) throw new Error("Shop-huurder niet gevonden");
  const placement = tenant.machinePlacements[0];
  if (!placement) throw new Error("Shopplaatsing niet gevonden");

  const context: Record<string, string> = {
    klant_naam: tenant.name,
    klant_adres: tenant.address ?? "",
    klant_gemeente: [tenant.city, tenant.province].filter(Boolean).join(", "),
    klant_telefoon: tenant.phone ?? "",
    klant_email: tenant.email ?? "",
    partner_naam: tenant.name,
    partner_telefoon: tenant.phone ?? "",
    partner_email: tenant.email ?? "",
    plaatsnummer: placement.shopSlot ? String(placement.shopSlot) : "",
    contractreferentie: placement.contractRef ?? "",
    contract_start: placement.contractStartedAt?.toLocaleDateString("nl-BE") ?? "",
    contract_einde: placement.contractEndsAt?.toLocaleDateString("nl-BE") ?? "",
    opzegtermijn_dagen: String(placement.noticePeriodDays),
    automaat: placement.product?.name ?? placement.model ?? "",
    serienummer: placement.serialNumber ?? "",
  };

  let document;
  try {
    ({ document } = await generateDocumentFromTemplate({
      templateCode: input.templateCode,
      context,
      title: `${tenant.name} · shopovereenkomst`,
      createdById: user.id,
      customerId: tenant.id,
      leadId: tenant.leadId,
    }));
  } catch (error) {
    if (error instanceof TemplateNotActiveError) {
      throw new Error("Dit partnersjabloon is niet actief");
    }
    throw error;
  }

  await audit(user.id, "shop.document_generated", "document", document.id, {
    customerId: tenant.id,
    placementId: placement.id,
    templateCode: input.templateCode,
  });
  revalidatePath(`/shop/${tenant.id}`);
  redirect(`/documenten/${document.id}`);
}
