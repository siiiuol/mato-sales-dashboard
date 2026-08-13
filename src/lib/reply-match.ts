/**
 * Bepaalt bij welke lead een binnengekomen mail hoort.
 *
 * Twee manieren, in deze volgorde:
 *
 * 1. Het gesprek. Antwoordt de prospect op onze mail, dan draagt zijn bericht
 *    dezelfde `conversationId` als wat wij verstuurden. Dat is de betrouwbare
 *    weg: hij werkt ook als er vanaf een ander adres binnen dezelfde zaak
 *    geantwoord wordt, en bij doorgestuurde antwoorden.
 * 2. Het afzenderadres. Voor wie zelf een nieuwe mail begint in plaats van te
 *    antwoorden.
 *
 * Past geen van beide, dan hoort de mail nergens bij en laten we hem staan.
 * Een mail aan de verkeerde lead hangen is erger dan hem niet tonen: dan staat
 * er iets in het dossier van een zaak die het nooit geschreven heeft.
 */

export type ReplyCandidate = {
  graphMessageId: string;
  conversationId: string | null;
  from: string;
};

export type MatchContext = {
  /** conversationId → leadId, uit wat wij eerder verstuurden. */
  conversationLeads: Map<string, string>;
  /** mailadres (kleine letters) → leadId. */
  leadEmails: Map<string, string>;
  /** Wat we al opgeslagen hebben; voorkomt dubbels bij een tweede ronde. */
  knownMessageIds: Set<string>;
};

export type Match = { graphMessageId: string; leadId: string; reason: "gesprek" | "afzender" };

export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function matchReply(
  message: ReplyCandidate,
  context: MatchContext
): Match | null {
  if (context.knownMessageIds.has(message.graphMessageId)) return null;

  if (message.conversationId) {
    const leadId = context.conversationLeads.get(message.conversationId);
    if (leadId) {
      return { graphMessageId: message.graphMessageId, leadId, reason: "gesprek" };
    }
  }

  const sender = normaliseAddress(message.from);
  if (sender) {
    const leadId = context.leadEmails.get(sender);
    if (leadId) {
      return { graphMessageId: message.graphMessageId, leadId, reason: "afzender" };
    }
  }

  return null;
}

/** Alles wat bij een lead te plaatsen is, in binnenkomstvolgorde. */
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
