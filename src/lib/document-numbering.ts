import "server-only";

import { prisma } from "./db";
import {
  documentDate,
  fillTemplate,
  formatDocumentNumber,
  missingPlaceholders,
  sequenceId,
  type DocumentContext,
} from "./documents";

/**
 * Het generieke deel van "een document maken van een sjabloon" — gedeeld door
 * elke stroom die ooit een genummerd document nodig heeft, niet alleen het
 * verkoopcontract.
 *
 * Bewust geen "use server": elke export uit een "use server"-bestand wordt
 * automatisch een vanaf de client aanroepbare Server Action, en `allocateNumber`
 * heeft geen eigen `requireUser`-controle (de aanroeper regelt dat al). Dit
 * bestand wordt alleen intern geïmporteerd door echte "use server"-bestanden —
 * zelfde opzet als `cadence-actions.ts` naast `cadences.ts`.
 */

/**
 * Geeft het volgende documentnummer uit.
 *
 * De teller loopt alleen omhoog en wordt met één `upsert` opgehoogd, zodat twee
 * gelijktijdige aanvragen niet hetzelfde nummer kunnen krijgen. Een nummer dat
 * twee keer bestaat is in de boekhouding een probleem dat pas maanden later
 * opvalt.
 */
export async function allocateNumber(prefix: string, year: number): Promise<string> {
  const sequence = await prisma.documentSequence.upsert({
    where: { id: sequenceId(prefix, year) },
    create: { id: sequenceId(prefix, year), prefix, year, counter: 1 },
    update: { counter: { increment: 1 } },
  });
  return formatDocumentNumber(prefix, year, sequence.counter);
}

export type GenerateFromTemplateInput = {
  templateCode: string;
  context: DocumentContext;
  title: string;
  createdById: string;
  leadId?: string | null;
  customerId?: string | null;
  dealId?: string | null;
};

export class TemplateNotActiveError extends Error {}

/**
 * Vult de actieve versie van een sjabloon in, nummert het, en legt het vast.
 *
 * "Actief" is MATO_APPROVED — de enige status uit de acht bestaande
 * `TEMPLATE_STATUSES` die hier telt; de rest (in nazicht, door boekhouder/
 * juridisch goedgekeurd) bestaat wel in het model maar wordt in deze fase niet
 * afgedwongen. Ontbrekende velden houden het document in concept, net als bij
 * het bestaande contract.
 */
export async function generateDocumentFromTemplate(input: GenerateFromTemplateInput) {
  const template = await prisma.documentTemplate.findFirst({
    where: { code: input.templateCode, status: "MATO_APPROVED" },
    orderBy: { version: "desc" },
  });
  if (!template) {
    throw new TemplateNotActiveError(
      `Er is geen actief sjabloon met code "${input.templateCode}".`
    );
  }

  const now = new Date();
  const number = await allocateNumber(template.numberPrefix, now.getFullYear());
  const body = fillTemplate(template.body, {
    documentnummer: number,
    datum: documentDate(now),
    ...input.context,
  });
  const missing = missingPlaceholders(body);

  const document = await prisma.generatedDocument.create({
    data: {
      number,
      title: input.title,
      templateId: template.id,
      templateCode: template.code,
      templateVersion: template.version,
      language: template.language,
      status: missing.length ? "DRAFT" : "READY",
      body,
      contextJson: JSON.stringify(input.context),
      validationJson: JSON.stringify({ missing }),
      leadId: input.leadId ?? null,
      customerId: input.customerId ?? null,
      dealId: input.dealId ?? null,
      createdById: input.createdById,
    },
  });

  return { document, missing };
}
