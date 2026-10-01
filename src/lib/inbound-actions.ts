/**
 * Verwerkt een website-aanvraag tot een lead of triage-rij.
 *
 * Gebruikt door de publieke API-route. Geen sessie — beveiliging zit in het
 * gedeelde geheim op de route, niet hier.
 */

import "server-only";

import { prisma } from "./db";
import {
  decideInbound,
  inboundDisplayName,
  inboundNotes,
  type InboundCandidate,
  type InboundPayload,
} from "./inbound-lead";
import { normalizePhone } from "./dedupe";

export type ProcessInboundResult = {
  submissionId: string;
  status: "CREATED" | "LINKED" | "OPEN";
  leadId: string | null;
  reason?: string;
};

function normaliseEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Haalt mogelijke treffers op en filtert in JS — zo werkt het op SQLite én
 * Postgres, zonder `mode: insensitive` dat alleen op Postgres bestaat.
 */
async function loadCandidates(payload: InboundPayload): Promise<InboundCandidate[]> {
  const email = normaliseEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const phoneTail = phone.length >= 8 ? phone.slice(-8) : "";

  type OrClause = { email?: { contains: string }; phone?: { contains: string } };
  const or: OrClause[] = [];
  if (email) {
    // Brede zoektocht; exacte match gebeurt hieronder na normaliseren.
    or.push({ email: { contains: email.split("@")[0] ?? email } });
  }
  if (phoneTail) {
    or.push({ phone: { contains: phoneTail } });
  }
  if (!or.length) return [];

  const [leads, customers] = await Promise.all([
    prisma.lead.findMany({
      where: { OR: or },
      select: { id: true, email: true, phone: true, status: true },
      take: 50,
    }),
    prisma.customer.findMany({
      where: { OR: or },
      select: {
        id: true,
        email: true,
        phone: true,
        leadId: true,
        lead: { select: { status: true } },
      },
      take: 50,
    }),
  ]);

  const leadCandidates: InboundCandidate[] = leads
    .filter(
      (lead) =>
        (email && normaliseEmail(lead.email) === email) ||
        (phoneTail && normalizePhone(lead.phone).endsWith(phoneTail))
    )
    .map((lead) => ({
      id: lead.id,
      kind: "lead" as const,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
    }));

  const customerCandidates: InboundCandidate[] = customers
    .filter(
      (customer) =>
        (email && normaliseEmail(customer.email) === email) ||
        (phoneTail && normalizePhone(customer.phone).endsWith(phoneTail))
    )
    .map((customer) => ({
      id: customer.id,
      kind: "customer" as const,
      email: customer.email,
      phone: customer.phone,
      leadId: customer.leadId,
      status: customer.lead?.status ?? null,
    }));

  return [...leadCandidates, ...customerCandidates];
}

/**
 * Slaat de ruwe inzending op en maakt of koppelt een lead.
 *
 * Bij twijfel blijft de submission OPEN zonder lead — geen stille dubbel.
 */
export async function processInboundSubmission(
  payload: InboundPayload,
  channel = "website"
): Promise<ProcessInboundResult> {
  const submission = await prisma.inboundSubmission.create({
    data: {
      payload: JSON.stringify(payload),
      channel,
      status: "OPEN",
    },
    select: { id: true },
  });

  try {
    const candidates = await loadCandidates(payload);
    const decision = decideInbound(payload, candidates);
    const now = new Date();

    if (decision.action === "create") {
      const lead = await prisma.lead.create({
        data: {
          name: inboundDisplayName(payload),
          email: payload.email?.trim() || null,
          phone: payload.phone?.trim() || null,
          city: payload.city?.trim() || null,
          address: payload.address?.trim() || null,
          notes: inboundNotes(payload),
          source: "website",
          sourceDetail: payload.sourceDetail?.trim().slice(0, 200) || null,
          status: "NEW",
          nextActionAt: now,
          lastTouchedAt: now,
        },
        select: { id: true },
      });

      await prisma.inboundSubmission.update({
        where: { id: submission.id },
        data: {
          status: "CREATED",
          leadId: lead.id,
          processedAt: now,
        },
      });

      return {
        submissionId: submission.id,
        status: "CREATED",
        leadId: lead.id,
      };
    }

    if (decision.action === "link" && decision.leadId) {
      const existing = await prisma.lead.findUnique({
        where: { id: decision.leadId },
        select: { notes: true },
      });

      await prisma.lead.update({
        where: { id: decision.leadId },
        data: {
          lastTouchedAt: now,
          nextActionAt: now,
          notes: appendNote(existing?.notes ?? null, inboundNotes(payload)),
        },
      });

      await prisma.inboundSubmission.update({
        where: { id: submission.id },
        data: {
          status: "LINKED",
          leadId: decision.leadId,
          processedAt: now,
        },
      });

      return {
        submissionId: submission.id,
        status: "LINKED",
        leadId: decision.leadId,
      };
    }

    await prisma.inboundSubmission.update({
      where: { id: submission.id },
      data: {
        status: "OPEN",
        error: decision.action === "triage" ? decision.reason : "Onbeslist",
        processedAt: now,
      },
    });

    return {
      submissionId: submission.id,
      status: "OPEN",
      leadId: null,
      reason: decision.action === "triage" ? decision.reason : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    await prisma.inboundSubmission
      .update({
        where: { id: submission.id },
        data: { error: message.slice(0, 500), processedAt: new Date() },
      })
      .catch(() => {});
    throw err;
  }
}

function appendNote(existing: string | null, addition: string): string {
  if (!existing?.trim()) return addition;
  return `${existing.trim()}\n\n---\n\n${addition}`.slice(0, 8000);
}
