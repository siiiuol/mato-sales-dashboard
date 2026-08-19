import { prisma } from "./db";
import { audit } from "./dal";
import { cancelCadence } from "./cadence-actions";
import type { LeadStatus } from "./types";

export type ContactType = "CALL" | "EMAIL" | "VISIT" | "NOTE";

export type ContactOutcome =
  | "NO_ANSWER"
  | "CALLBACK"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "VOICEMAIL"
  | "WRONG_NUMBER"
  | "OTHER"
  | "SENT"
  | "NO_REPLY";

export function statusForContact(
  type: ContactType,
  outcome: ContactOutcome | null | undefined
): LeadStatus {
  if (type === "NOTE") {
    return outcome === "CALLBACK" ? "FOLLOW_UP" : "CONTACTED";
  }

  if (!outcome) return "CONTACTED";

  if (outcome === "INTERESTED") return "NEGOTIATION";
  if (outcome === "NOT_INTERESTED") return "LOST";
  if (
    outcome === "CALLBACK" ||
    outcome === "VOICEMAIL" ||
    outcome === "NO_ANSWER" ||
    outcome === "NO_REPLY"
  ) {
    return "FOLLOW_UP";
  }
  if (outcome === "WRONG_NUMBER") return "DO_NOT_CONTACT";
  return "CONTACTED";
}

/** @deprecated gebruik statusForContact */
export function statusForOutcome(outcome: ContactOutcome): LeadStatus {
  return statusForContact("CALL", outcome);
}

export type CallOutcome = ContactOutcome;

/**
 * Eén pad voor het noteren van contact — bellen, mail, bezoek of notitie.
 * Zet eigenaar, ruimt claim op, schrijft audit.
 */
export async function logContactForLead(input: {
  leadId: string;
  type: ContactType;
  outcome?: ContactOutcome | null;
  note?: string | null;
  callbackAt?: string | null;
  userId: string;
}) {
  const { leadId, type, userId } = input;
  const note = input.note?.trim() || null;
  const callbackAt = input.callbackAt?.trim() || "";
  const outcome = input.outcome ?? null;

  if (type !== "NOTE" && !outcome) {
    throw new Error("Kies een resultaat");
  }
  if (type === "NOTE" && !note) {
    throw new Error("Schrijf een notitie");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { doNotContact: true, complianceStatus: true, ownerId: true },
  });
  if (!lead) {
    throw new Error("Lead niet gevonden");
  }
  if (lead.doNotContact || lead.complianceStatus === "BLOCKED") {
    throw new Error("Geblokkeerd: deze lead mag niet gecontacteerd worden");
  }

  const wantsFollowUp =
    outcome === "CALLBACK" || (type === "NOTE" && Boolean(callbackAt));
  const nextFollowUpAt =
    wantsFollowUp && callbackAt
      ? new Date(callbackAt)
      : null;
  const status = statusForContact(type, outcome);

  const event = await prisma.outreachEvent.create({
    data: {
      leadId,
      type,
      outcome,
      note,
      nextFollowUpAt: nextFollowUpAt ?? undefined,
      createdById: userId,
    },
    select: { id: true },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      nextActionAt:
        nextFollowUpAt ??
        (status === "FOLLOW_UP" ? new Date(Date.now() + 86400000) : null),
      lastTouchedAt: new Date(),
      claimedById: null,
      claimedAt: null,
      ownerId: lead.ownerId ?? userId,
      ...(lead.ownerId ? {} : { ownedAt: new Date() }),
    },
  });

  await audit(userId, "contact.logged", "lead", leadId, {
    type,
    outcome,
  });

  // Er is echt contact geweest — een herinnering die daarna nog afgaat is
  // erger dan geen herinnering.
  await cancelCadence({ leadId }, "LEAD_FOLLOWUP").catch((err) =>
    console.error("kon opvolgreeks niet annuleren", err)
  );

  // Teruggegeven zodat de aanroeper het formulier kan verversen; zie
  // `ContactLogState.savedId`.
  return event.id;
}

/** @deprecated gebruik logContactForLead */
export async function logCallForLead(input: {
  leadId: string;
  outcome: ContactOutcome;
  note?: string | null;
  callbackAt?: string | null;
  userId: string;
}) {
  return logContactForLead({
    ...input,
    type: "CALL",
  });
}
