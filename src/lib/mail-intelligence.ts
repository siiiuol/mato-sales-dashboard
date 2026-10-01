/**
 * AI-extractie van feiten uit één inkomende mail.
 *
 * Resultaat landt als SUGGESTED CustomerFact — nooit stil als waarheid.
 * De JSON-cache op MailMessage voorkomt dat hetzelfde bericht twee keer
 * betaald wordt.
 */

import "server-only";

import { completeJson, AnthropicConfigError } from "./anthropic";
import {
  FACT_KEYS,
  FACT_LABELS,
  sanitizeSuggestedFacts,
  type FactKey,
} from "./customer-memory";
import { prisma } from "./db";
import { readSettingSecret } from "./settings-secrets";

const SYSTEM = `Je haalt feiten uit één e-mail van een prospect of klant van MATO Automaat (snack- en drankautomaten in België).
Geef alleen feiten die écht in de mail staan. Verzin niets. Twijfel = weglaten.
Sleutels die je mag gebruiken: ${FACT_KEYS.map((k) => `${k} (${FACT_LABELS[k]})`).join(", ")}.
Antwoord strikt als JSON volgens het schema.`;

export const MAIL_FACT_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["key", "value", "confidence"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["facts", "summary"],
  additionalProperties: false,
} as const;

export type MailExtractResult = {
  skipped?: boolean;
  reason?: string;
  suggested?: number;
};

/**
 * Extraheert feiten uit één bewaard bericht. Idempotent via aiExtractedAt.
 */
export async function extractFactsFromMailMessage(
  mailMessageId: string
): Promise<MailExtractResult> {
  const message = await prisma.mailMessage.findUnique({
    where: { id: mailMessageId },
    select: {
      id: true,
      direction: true,
      subject: true,
      body: true,
      fromAddress: true,
      leadId: true,
      customerId: true,
      aiExtractedAt: true,
    },
  });

  if (!message) return { skipped: true, reason: "missing" };
  if (message.direction !== "IN") return { skipped: true, reason: "not-inbound" };
  if (!message.leadId && !message.customerId) {
    return { skipped: true, reason: "unmatched" };
  }
  if (message.aiExtractedAt) return { skipped: true, reason: "cached" };

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { anthropicApiKey: true, anthropicModel: true },
  });
  const apiKey = readSettingSecret(settings?.anthropicApiKey);
  if (!apiKey.trim()) return { skipped: true, reason: "no-api-key" };

  const prompt = [
    `Afzender: ${message.fromAddress || "(onbekend)"}`,
    `Onderwerp: ${message.subject}`,
    "",
    message.body.slice(0, 8_000) || "(lege body)",
  ].join("\n");

  let content: string;
  try {
    content = await completeJson({
      apiKey,
      model: settings?.anthropicModel || "claude-opus-5",
      system: SYSTEM,
      prompt,
      schema: MAIL_FACT_SCHEMA,
    });
  } catch (err) {
    if (err instanceof AnthropicConfigError) {
      return { skipped: true, reason: "no-api-key" };
    }
    throw err;
  }

  let parsed: { facts?: unknown; summary?: string } = {};
  try {
    parsed = JSON.parse(content) as { facts?: unknown; summary?: string };
  } catch {
    parsed = { facts: [] };
  }

  const facts = sanitizeSuggestedFacts(parsed.facts);

  await prisma.mailMessage.update({
    where: { id: message.id },
    data: {
      aiExtract: JSON.stringify({
        facts,
        summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
      }),
      aiExtractedAt: new Date(),
    },
  });

  let suggested = 0;
  for (const fact of facts) {
    const created = await suggestFact({
      leadId: message.leadId,
      customerId: message.customerId,
      key: fact.key,
      value: fact.value,
      confidence: fact.confidence,
      sourceMailId: message.id,
    });
    if (created) suggested++;
  }

  return { suggested };
}

async function suggestFact(input: {
  leadId: string | null;
  customerId: string | null;
  key: FactKey;
  value: string;
  confidence: number;
  sourceMailId: string;
}): Promise<boolean> {
  const existing = await prisma.customerFact.findFirst({
    where: {
      key: input.key,
      value: input.value,
      status: { in: ["SUGGESTED", "CONFIRMED"] },
      OR: [
        ...(input.leadId ? [{ leadId: input.leadId }] : []),
        ...(input.customerId ? [{ customerId: input.customerId }] : []),
      ],
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.customerFact.create({
    data: {
      leadId: input.leadId,
      customerId: input.customerId,
      key: input.key,
      value: input.value,
      confidence: input.confidence,
      status: "SUGGESTED",
      source: "MAIL",
      sourceMailId: input.sourceMailId,
    },
  });
  return true;
}

/**
 * Extraheert feiten voor een batch nieuwe inbound-mail-id's.
 * Hard plafond zodat één cron-ronde niet vastloopt op Anthropic.
 */
export async function extractFactsForMails(
  mailIds: readonly string[],
  limit = 5
): Promise<{ processed: number; suggested: number }> {
  let processed = 0;
  let suggested = 0;
  for (const id of mailIds.slice(0, limit)) {
    try {
      const result = await extractFactsFromMailMessage(id);
      if (!result.skipped) {
        processed++;
        suggested += result.suggested ?? 0;
      }
    } catch (err) {
      console.error("mail-fact extractie mislukt", id, err);
    }
  }
  return { processed, suggested };
}
