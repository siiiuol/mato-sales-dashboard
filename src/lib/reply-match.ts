/**
 * Bepaalt bij welke lead of klant een mail hoort.
 *
 * Volgorde:
 *
 * 1. Het gesprek (`conversationId`) — betrouwbaarst.
 * 2. Exact e-mailadres van een lead.
 * 3. Exact e-mailadres van een klant.
 * 4. Uniek bedrijfsdomein (geen Gmail e.d.) — alleen als precies één match.
 *
 * Past geen van die, dan null: liever triage dan de verkeerde fiche.
 */

export type ReplyCandidate = {
  graphMessageId: string;
  conversationId: string | null;
  from: string;
  to?: string;
  /** IN = match op afzender · OUT = match op ontvanger. */
  direction?: "IN" | "OUT";
};

export type MatchTarget = {
  leadId?: string | null;
  customerId?: string | null;
};

export type MatchContext = {
  /** conversationId → lead (+ optioneel klant). */
  conversationLeads: Map<string, MatchTarget>;
  /** mailadres (kleine letters) → lead. */
  leadEmails: Map<string, MatchTarget>;
  /** mailadres (kleine letters) → klant. */
  customerEmails: Map<string, MatchTarget>;
  /**
   * Bedrijfsdomein → kandidaten. Alleen gebruikt als er precies één is.
   * Consumentendomeinen (gmail, …) horen hier niet in.
   */
  domains: Map<string, MatchTarget[]>;
  /** Wat we al opgeslagen hebben; voorkomt dubbels bij een tweede ronde. */
  knownMessageIds: Set<string>;
};

export type MatchReason = "gesprek" | "afzender" | "klant" | "domein";

export type Match = {
  graphMessageId: string;
  leadId: string | null;
  customerId: string | null;
  reason: MatchReason;
  confidence: number;
};

/** Consumentendomeinen — daarop nooit matchen; te veel valse treffers. */
export const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.be",
  "outlook.com",
  "outlook.be",
  "live.com",
  "live.be",
  "msn.com",
  "yahoo.com",
  "yahoo.be",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "skynet.be",
  "telenet.be",
  "proximus.be",
  "scarlet.be",
]);

export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** Domein uit een adres, of null bij ongeldig / consument. */
export function businessDomain(address: string): string | null {
  const normalised = normaliseAddress(address);
  const at = normalised.lastIndexOf("@");
  if (at < 1 || at === normalised.length - 1) return null;
  const domain = normalised.slice(at + 1);
  if (!domain.includes(".") || CONSUMER_DOMAINS.has(domain)) return null;
  return domain;
}

function counterparty(message: ReplyCandidate): string {
  if (message.direction === "OUT") {
    return normaliseAddress(message.to ?? "");
  }
  return normaliseAddress(message.from);
}

function asMatch(
  graphMessageId: string,
  target: MatchTarget,
  reason: MatchReason,
  confidence: number
): Match {
  return {
    graphMessageId,
    leadId: target.leadId ?? null,
    customerId: target.customerId ?? null,
    reason,
    confidence,
  };
}

export function matchReply(
  message: ReplyCandidate,
  context: MatchContext
): Match | null {
  if (context.knownMessageIds.has(message.graphMessageId)) return null;

  if (message.conversationId) {
    const target = context.conversationLeads.get(message.conversationId);
    if (target && (target.leadId || target.customerId)) {
      return asMatch(message.graphMessageId, target, "gesprek", 1);
    }
  }

  const party = counterparty(message);
  if (party) {
    const lead = context.leadEmails.get(party);
    if (lead && (lead.leadId || lead.customerId)) {
      return asMatch(message.graphMessageId, lead, "afzender", 0.95);
    }

    const customer = context.customerEmails.get(party);
    if (customer && (customer.customerId || customer.leadId)) {
      return asMatch(message.graphMessageId, customer, "klant", 0.9);
    }

    const domain = businessDomain(party);
    if (domain) {
      const candidates = context.domains.get(domain) ?? [];
      if (candidates.length === 1) {
        return asMatch(message.graphMessageId, candidates[0], "domein", 0.55);
      }
    }
  }

  return null;
}

/** Alles wat bij een lead of klant te plaatsen is, in binnenkomstvolgorde. */
export function matchReplies(
  messages: ReplyCandidate[],
  context: MatchContext
): Match[] {
  const matches: Match[] = [];
  const seen = new Set(context.knownMessageIds);

  for (const message of messages) {
    const match = matchReply(message, { ...context, knownMessageIds: seen });
    if (match) {
      matches.push(match);
      // Binnen dezelfde ronde kan hetzelfde bericht twee keer langskomen als
      // Graph overlappende pagina's teruggeeft.
      seen.add(match.graphMessageId);
    }
  }

  return matches;
}

/**
 * Bouwt de domeinkaart: alleen bedrijfsdomeinen, gegroepeerd.
 * Dubbele targets op hetzelfde domein blijven staan — matchReply kiest dan
 * niets (ambigu), zodat zo'n mail naar triage kan.
 */
export function buildDomainIndex(
  entries: Array<{ email: string; target: MatchTarget }>
): Map<string, MatchTarget[]> {
  const domains = new Map<string, MatchTarget[]>();
  for (const entry of entries) {
    const domain = businessDomain(entry.email);
    if (!domain) continue;
    const list = domains.get(domain) ?? [];
    const key = `${entry.target.leadId ?? ""}|${entry.target.customerId ?? ""}`;
    if (
      !list.some(
        (t) => `${t.leadId ?? ""}|${t.customerId ?? ""}` === key
      )
    ) {
      list.push(entry.target);
    }
    domains.set(domain, list);
  }
  return domains;
}

/**
 * Bewaar ongecouplede mail alleen als die relevant lijkt — anders vult de
 * triage zich met nieuwsbrieven.
 *
 * - Verzonden: altijd (wij kozen dit adres).
 * - Inbox: alleen als het domein in onze CRM-domeinen zit, of het een antwoord
 *   lijkt (Re:/FW:/Antw:).
 */
export function shouldKeepUnmatched(
  message: {
    direction: "IN" | "OUT";
    from: string;
    to: string;
    subject: string;
    conversationId: string | null;
  },
  knownBusinessDomains: ReadonlySet<string>
): boolean {
  if (message.direction === "OUT") return true;

  const subject = message.subject.trim().toLowerCase();
  if (
    /^(re|fw|fwd|antw|sv)\s*:/.test(subject) ||
    Boolean(message.conversationId)
  ) {
    return true;
  }

  const domain = businessDomain(message.from);
  return Boolean(domain && knownBusinessDomains.has(domain));
}
