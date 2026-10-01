/**
 * Matching van een website-aanvraag tegen bestaande leads en klanten.
 *
 * Puur — geen Prisma. De server-actie levert kandidaten aan; hier wordt
 * besloten: koppelen, aanmaken, of naar triage (bij twijfel).
 */

import { normalizePhone } from "./dedupe";

export type InboundPayload = {
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  message?: string | null;
  company?: string | null;
  sourceDetail?: string | null;
};

export type InboundCandidate = {
  id: string;
  kind: "lead" | "customer";
  email: string | null;
  phone: string | null;
  /** Bij een klant: de gekoppelde open lead, als die er is. */
  leadId?: string | null;
  status?: string | null;
};

export type InboundDecision =
  | { action: "link"; candidateId: string; kind: "lead" | "customer"; leadId: string | null }
  | { action: "create" }
  | { action: "triage"; reason: string };

function normaliseEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

const OPEN_STATUSES = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
]);

/**
 * Beslist wat er met één inzending moet gebeuren.
 *
 * Exacte e-mail of telefoon → koppelen.
 * Meerdere treffers → triage (geen dubbele zaak aanmaken).
 * Geen treffer → nieuwe lead.
 */
export function decideInbound(
  payload: InboundPayload,
  candidates: readonly InboundCandidate[]
): InboundDecision {
  const email = normaliseEmail(payload.email);
  const phone = normalizePhone(payload.phone);

  const emailHits = email
    ? candidates.filter((c) => normaliseEmail(c.email) === email)
    : [];
  const phoneHits =
    phone.length >= 8
      ? candidates.filter((c) => normalizePhone(c.phone) === phone)
      : [];

  const hits = dedupeCandidates([...emailHits, ...phoneHits]);

  if (hits.length === 0) return { action: "create" };
  if (hits.length > 1) {
    return {
      action: "triage",
      reason: "Meerdere treffers op e-mail of telefoon — handmatig kiezen.",
    };
  }

  const hit = hits[0];
  if (hit.kind === "lead") {
    return {
      action: "link",
      candidateId: hit.id,
      kind: "lead",
      leadId: hit.id,
    };
  }

  // Klant: als er een open lead aan hangt, hang daar aan; anders triage
  // (geen stille nieuwe lead naast een bestaande klant).
  if (hit.leadId && OPEN_STATUSES.has(hit.status ?? "NEW")) {
    return {
      action: "link",
      candidateId: hit.id,
      kind: "customer",
      leadId: hit.leadId,
    };
  }

  return {
    action: "triage",
    reason: "Bestaande klant zonder open zaak — handmatig opvolgen.",
  };
}

function dedupeCandidates(rows: InboundCandidate[]): InboundCandidate[] {
  const seen = new Set<string>();
  const out: InboundCandidate[] = [];
  for (const row of rows) {
    const key = `${row.kind}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Bouwt de notitie die op de lead komt te staan. */
export function inboundNotes(payload: InboundPayload): string {
  const parts: string[] = ["Aanvraag via website."];
  if (payload.company?.trim()) parts.push(`Bedrijf: ${payload.company.trim()}`);
  if (payload.message?.trim()) parts.push(payload.message.trim());
  return parts.join("\n\n").slice(0, 4000);
}

export function inboundDisplayName(payload: InboundPayload): string {
  const company = payload.company?.trim();
  const name = payload.name.trim();
  if (company && name && company.toLowerCase() !== name.toLowerCase()) {
    return `${company} (${name})`.slice(0, 200);
  }
  return (company || name || "Website-aanvraag").slice(0, 200);
}
