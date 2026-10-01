/**
 * Mailbox-sync buiten een knopdruk: Postvak IN én Verzonden items.
 *
 * Gebruikt door de handmatige knop én door de cron. Geen sessie nodig — alleen
 * een userId van een gekoppeld postvak. Matching blijft beperkt tot de leads
 * (en klanten) die deze medewerker mag zien, zodat mail van Louis niet op de
 * fiche van een collega belandt.
 */

import "server-only";

import { prisma } from "./db";
import { accessTokenFor, MailboxError } from "./mailbox";
import { fetchInbox, fetchSent, GraphError, type IncomingMessage } from "./graph";
import {
  buildDomainIndex,
  matchReplies,
  normaliseAddress,
  shouldKeepUnmatched,
  type Match,
  type MatchTarget,
} from "./reply-match";
import { cancelContactCadences } from "./cadence-actions";
import { SecretError } from "./secrets";

export type MailboxSyncResult = {
  userId: string;
  added: number;
  unmatched: number;
  failed: number;
  truncated: boolean;
  error?: string;
};

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

function sinceFor(connectionCreatedAt: Date, lastInbound: Date | null): Date {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return new Date(
    Math.max(
      lastInbound?.getTime() ?? 0,
      connectionCreatedAt.getTime(),
      monthAgo.getTime()
    )
  );
}

function toCandidate(message: IncomingMessage) {
  const direction = message.folder === "sentitems" ? ("OUT" as const) : ("IN" as const);
  return {
    graphMessageId: message.graphMessageId,
    conversationId: message.conversationId,
    from: message.from,
    to: message.to,
    direction,
  };
}

/**
 * Synchroniseert één postvak.
 *
 * `asAdmin: true` mag over alle leads matchen (handmatige knop van beheerder).
 * De cron gebruikt altijd `asAdmin: false` per postvak-eigenaar.
 */
export async function syncMailboxForUser(
  userId: string,
  options: { asAdmin?: boolean } = {}
): Promise<MailboxSyncResult> {
  const connection = await prisma.mailboxConnection.findUnique({
    where: { userId },
    select: { createdAt: true },
  });
  if (!connection) {
    return {
      userId,
      added: 0,
      unmatched: 0,
      failed: 0,
      truncated: false,
      error: "Mailbox is nog niet gekoppeld.",
    };
  }

  const lastStored = await prisma.mailMessage.findFirst({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  const since = sinceFor(connection.createdAt, lastStored?.occurredAt ?? null);

  try {
    const token = await accessTokenFor(userId);
    const [inbox, sent] = await Promise.all([
      fetchInbox({ accessToken: token, since }),
      fetchSent({ accessToken: token, since }),
    ]);

    const incoming = [...inbox.messages, ...sent.messages].sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
    );
    const truncated = inbox.truncated || sent.truncated;

    if (!incoming.length) {
      await prisma.mailboxConnection.update({
        where: { userId },
        data: { lastSyncAt: new Date(), syncError: null },
      });
      return { userId, added: 0, unmatched: 0, failed: 0, truncated };
    }

    const mine = options.asAdmin
      ? {}
      : { OR: [{ ownerId: userId }, { ownerId: null }] };

    const [ourMessages, leadsWithEmail, customersWithEmail] = await Promise.all([
      prisma.mailMessage.findMany({
        where: {
          conversationId: { not: null },
          leadId: { not: null },
          ...(options.asAdmin ? {} : { userId }),
        },
        select: {
          conversationId: true,
          leadId: true,
          customerId: true,
        },
      }),
      prisma.lead.findMany({
        where: { email: { not: null }, ...mine },
        select: {
          id: true,
          email: true,
          customer: { select: { id: true } },
        },
      }),
      prisma.customer.findMany({
        where: { email: { not: null }, ...mine },
        select: { id: true, email: true, leadId: true },
      }),
    ]);

    const known = await prisma.mailMessage.findMany({
      where: {
        graphMessageId: { in: incoming.map((m) => m.graphMessageId) },
      },
      select: { graphMessageId: true },
    });

    const conversationLeads = new Map<string, MatchTarget>();
    for (const row of ourMessages) {
      if (!row.conversationId || !row.leadId) continue;
      conversationLeads.set(row.conversationId, {
        leadId: row.leadId,
        customerId: row.customerId,
      });
    }

    const leadEmails = new Map<string, MatchTarget>();
    const domainEntries: Array<{ email: string; target: MatchTarget }> = [];

    for (const lead of leadsWithEmail) {
      if (!lead.email) continue;
      const target: MatchTarget = {
        leadId: lead.id,
        customerId: lead.customer?.id ?? null,
      };
      leadEmails.set(normaliseAddress(lead.email), target);
      domainEntries.push({ email: lead.email, target });
    }

    const customerEmails = new Map<string, MatchTarget>();
    for (const customer of customersWithEmail) {
      if (!customer.email) continue;
      const target: MatchTarget = {
        customerId: customer.id,
        leadId: customer.leadId,
      };
      customerEmails.set(normaliseAddress(customer.email), target);
      domainEntries.push({ email: customer.email, target });
    }

    const domains = buildDomainIndex(domainEntries);
    const knownBusinessDomains = new Set(domains.keys());
    const knownMessageIds = new Set(
      known
        .map((m) => m.graphMessageId)
        .filter((id): id is string => Boolean(id))
    );

    const candidates = incoming.map(toCandidate);
    const matches = matchReplies(candidates, {
      conversationLeads,
      leadEmails,
      customerEmails,
      domains,
      knownMessageIds,
    });
    const matchedIds = new Set(matches.map((m) => m.graphMessageId));

    const byId = new Map(incoming.map((m) => [m.graphMessageId, m]));
    let added = 0;
    let unmatched = 0;
    let failed = 0;
    const touchedLeads = new Set<string>();
    const newInboundIds: string[] = [];

    for (const match of matches) {
      const message = byId.get(match.graphMessageId);
      if (!message) continue;
      const ok = await storeMessage({
        userId,
        message,
        match,
      });
      if (ok.status === "added") {
        added++;
        if (match.leadId && message.folder === "inbox") {
          touchedLeads.add(match.leadId);
        }
        if (ok.id && message.folder === "inbox" && (match.leadId || match.customerId)) {
          newInboundIds.push(ok.id);
        }
      } else if (ok.status === "failed") {
        failed++;
      }
    }

    for (const message of incoming) {
      if (matchedIds.has(message.graphMessageId)) continue;
      if (knownMessageIds.has(message.graphMessageId)) continue;

      const direction = message.folder === "sentitems" ? "OUT" : "IN";
      if (
        !shouldKeepUnmatched(
          {
            direction,
            from: message.from,
            to: message.to,
            subject: message.subject,
            conversationId: message.conversationId,
          },
          knownBusinessDomains
        )
      ) {
        continue;
      }

      const ok = await storeMessage({
        userId,
        message,
        match: null,
      });
      if (ok.status === "added") unmatched++;
      else if (ok.status === "failed") failed++;
    }

    for (const leadId of touchedLeads) {
      await cancelContactCadences({ leadId }).catch((err) =>
        console.error("kon opvolgreeks niet annuleren", err)
      );
    }

    if (newInboundIds.length) {
      const { extractFactsForMails } = await import("./mail-intelligence");
      await extractFactsForMails(newInboundIds, 5).catch((err) =>
        console.error("mail-fact extractie na sync mislukt", err)
      );
    }

    await prisma.mailboxConnection.update({
      where: { userId },
      data: { lastSyncAt: new Date(), syncError: null },
    });

    return { userId, added, unmatched, failed, truncated };
  } catch (err) {
    const message =
      err instanceof MailboxError ||
      err instanceof GraphError ||
      err instanceof SecretError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Onbekende syncfout";

    await prisma.mailboxConnection
      .update({
        where: { userId },
        data: { syncError: message.slice(0, 500) },
      })
      .catch(() => {});

    return {
      userId,
      added: 0,
      unmatched: 0,
      failed: 0,
      truncated: false,
      error: message,
    };
  }
}

async function storeMessage({
  userId,
  message,
  match,
}: {
  userId: string;
  message: IncomingMessage;
  match: Match | null;
}): Promise<{ status: "added" | "duplicate" | "failed"; id?: string }> {
  const direction = message.folder === "sentitems" ? "OUT" : "IN";
  try {
    const row = await prisma.mailMessage.create({
      data: {
        leadId: match?.leadId ?? null,
        customerId: match?.customerId ?? null,
        userId,
        direction,
        folder: message.folder === "sentitems" ? "SENT" : "INBOX",
        subject: message.subject,
        body: message.body.slice(0, 20_000),
        fromAddress: message.from,
        toAddress: message.to,
        occurredAt: message.receivedAt,
        graphMessageId: message.graphMessageId,
        conversationId: message.conversationId,
        matchedBy: match?.reason ?? null,
        matchConfidence: match?.confidence ?? null,
      },
      select: { id: true },
    });
    return { status: "added", id: row.id };
  } catch (err) {
    if (isDuplicateKey(err)) return { status: "duplicate" };
    console.error("mail kon niet opgeslagen worden", err);
    return { status: "failed" };
  }
}

/** Alle gekoppelde postvakken — voor de cron. */
export async function syncAllMailboxes(): Promise<{
  results: MailboxSyncResult[];
  added: number;
  unmatched: number;
  failed: number;
  errors: number;
}> {
  const connections = await prisma.mailboxConnection.findMany({
    select: { userId: true },
  });

  const results: MailboxSyncResult[] = [];
  for (const connection of connections) {
    // Sequentiële rondes: Graph rate-limits en token-refresh per gebruiker.
    results.push(await syncMailboxForUser(connection.userId, { asAdmin: false }));
  }

  return {
    results,
    added: results.reduce((n, r) => n + r.added, 0),
    unmatched: results.reduce((n, r) => n + r.unmatched, 0),
    failed: results.reduce((n, r) => n + r.failed, 0),
    errors: results.filter((r) => r.error).length,
  };
}
