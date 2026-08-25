import { prisma } from "./db";
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
  lossReason?: string | null;
  userId: string;
}) {
  const { leadId, type, userId } = input;
  const note = input.note?.trim() || null;
  const callbackAt = input.callbackAt?.trim() || "";
  const outcome = input.outcome ?? null;
  const lossReason = input.lossReason?.trim() || null;

  if (type !== "NOTE" && !outcome) {
    throw new Error("Kies een resultaat");
  }
  if (type === "NOTE" && !note) {
    throw new Error("Schrijf een notitie");
  }
  if (outcome === "NOT_INTERESTED" && !lossReason) {
    throw new Error("Kies waarom deze kans stopt");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      doNotContact: true,
      complianceStatus: true,
      ownerId: true,
      status: true,
    },
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
  const status =
    type === "NOTE" ? (lead.status as LeadStatus) : statusForContact(type, outcome);

  const now = new Date();
  const eventId = await prisma.$transaction(async (tx) => {
    const event = await tx.outreachEvent.create({
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

    await tx.lead.update({
      where: { id: leadId },
      data: {
        status,
        nextActionAt:
          nextFollowUpAt ??
          (status === "FOLLOW_UP" ? new Date(now.getTime() + 86400000) : null),
        lastTouchedAt: now,
        claimedById: null,
        claimedAt: null,
        ownerId: lead.ownerId ?? userId,
        ...(lead.ownerId ? {} : { ownedAt: now }),
        lossReason: status === "LOST" ? lossReason : null,
        parkedUntil: null,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorId: userId,
        action: "contact.logged",
        entityType: "lead",
        entityId: leadId,
        detail: JSON.stringify({ type, outcome, lossReason }),
      },
    });

    return event.id;
  });

  // Er is echt contact geweest — een herinnering die daarna nog afgaat is
  // erger dan geen herinnering.
  await cancelCadence({ leadId }, "LEAD_FOLLOWUP").catch((err) =>
    console.error("kon opvolgreeks niet annuleren", err)
  );

  // Teruggegeven zodat de aanroeper het formulier kan verversen; zie
  // `ContactLogState.savedId`.
  return eventId;
}

/** @deprecated gebruik logContactForLead */
export async function logCallForLead(input: {
  leadId: string;
  outcome: ContactOutcome;
  note?: string | null;
  callbackAt?: string | null;
  lossReason?: string | null;
  userId: string;
}) {
  return logContactForLead({
    ...input,
    type: "CALL",
  });
}
