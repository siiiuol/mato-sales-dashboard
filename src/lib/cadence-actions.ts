import "server-only";

import { prisma } from "./db";
import { stepsFor, type CadenceKey } from "./cadences";

/**
 * Inschrijven in en annuleren van een opvolgcadans.
 *
 * Geen apart inschrijvings-record: "alle openstaande stappen van deze
 * inschrijving" is gewoon een `Task`-rij met dezelfde `leadId`/`customerId` en
 * `cadenceKey`. Dat is genoeg om te groeperen, te annuleren, en te zien dat
 * er al ingeschreven is.
 */

/**
 * Schrijft een lead in voor de opvolgreeks na een eerste mail.
 *
 * Alleen als er nog geen open LEAD_FOLLOWUP-taken voor deze lead bestaan —
 * niet "ooit", want een lead die eerder een cadans doorliep (afgerond of
 * geannuleerd) mag na een nieuwe eerste mail gewoon opnieuw beginnen.
 */
export async function enrollLeadFollowup(leadId: string, assignedToId: string) {
  const existing = await prisma.task.findFirst({
    where: { leadId, cadenceKey: "LEAD_FOLLOWUP", status: "OPEN" },
    select: { id: true },
  });
  if (existing) return;

  const steps = stepsFor("LEAD_FOLLOWUP");
  await prisma.task.createMany({
    data: steps.map((s) => ({
      title: s.title,
      leadId,
      assignedToId,
      dueAt: s.dueAt,
      cadenceKey: "LEAD_FOLLOWUP" satisfies CadenceKey,
      cadenceStep: s.step,
      status: "OPEN",
    })),
  });
}

/**
 * Schrijft een klant in voor de opstartcadans, eenmalig per klant.
 *
 * Anders dan bij een lead: dit start maar één keer in de levensduur van een
 * klant, dus hier telt "ooit ingeschreven geweest" — niet alleen "nu open".
 */
export async function enrollCustomerOnboarding(customerId: string, assignedToId: string) {
  const existing = await prisma.task.findFirst({
    where: { customerId, cadenceKey: "CUSTOMER_ONBOARDING" },
    select: { id: true },
  });
  if (existing) return;

  const steps = stepsFor("CUSTOMER_ONBOARDING");
  await prisma.task.createMany({
    data: steps.map((s) => ({
      title: s.title,
      customerId,
      assignedToId,
      dueAt: s.dueAt,
      cadenceKey: "CUSTOMER_ONBOARDING" satisfies CadenceKey,
      cadenceStep: s.step,
      status: "OPEN",
    })),
  });
}

export async function enrollInstallHandoff(
  customerId: string,
  dealId: string,
  assignedToId: string,
  startAt = new Date()
) {
  const existing = await prisma.task.findFirst({
    where: { dealId, cadenceKey: "INSTALL_HANDOFF" },
    select: { id: true },
  });
  if (existing) return;

  await prisma.task.createMany({
    data: stepsFor("INSTALL_HANDOFF", startAt).map((step) => ({
      title: step.title,
      customerId,
      dealId,
      assignedToId,
      dueAt: step.dueAt,
      cadenceKey: "INSTALL_HANDOFF" satisfies CadenceKey,
      cadenceStep: step.step,
      status: "OPEN",
    })),
  });
}

/**
 * Annuleert alle openstaande stappen van één cadans op één lead of klant.
 *
 * Dit moet in élk pad hangen dat "er is al contact geweest" betekent. Een
 * herinnering die afgaat ná een echt antwoord is erger dan geen herinnering —
 * dat is de snelste weg naar "ik negeer die taken toch maar".
 */
export async function cancelCadence(
  entity: { leadId: string } | { customerId: string },
  cadenceKey: CadenceKey
) {
  await prisma.task.updateMany({
    where: { ...entity, cadenceKey, status: "OPEN" },
    data: { status: "CANCELLED" },
  });
}
