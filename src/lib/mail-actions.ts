"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { buildMailPrompt, SYSTEM_PROMPT } from "./mail-prompt";
import { catalogPromptBlock, suggestMachineHint } from "./mato-catalog";
import { draftMail, AnthropicConfigError } from "./anthropic";
import { formObject, idSchema } from "./validation";
import { accessTokenFor, disconnectMailbox, MailboxError } from "./mailbox";
import { GraphError, sendMail } from "./graph";
import { enrollLeadFollowup } from "./cadence-actions";
import { syncMailboxForUser } from "./mail-sync";
import { readSettingSecret } from "./settings-secrets";
import { SecretError } from "./secrets";
import { fetchWebsiteText } from "./website-research";

export type MailDraftState = {
  error?: string;
  subject?: string;
  body?: string;
  draftId?: string;
};

export type MailSendState = {
  error?: string;
  sent?: boolean;
  saved?: boolean;
  to?: string;
  /** Verstuurd, maar er ging daarna iets mis met het vastleggen. */
  warning?: string;
};

export type MailSyncState = {
  error?: string;
  checked?: boolean;
  added?: number;
  /** Berichten bewaard zonder lead/klant — voor latere triage. */
  unmatched?: number;
  /** Berichten die wel pasten maar niet weggeschreven konden worden. */
  failed?: number;
  /** Er stond meer klaar dan in één ronde paste. */
  truncated?: boolean;
};

/**
 * Stelt een mail op voor deze lead.
 *
 * Er wordt niets verstuurd. De tekst komt terug op het scherm, de medewerker
 * leest hem na en past hem aan; versturen is een aparte handeling. Een model
 * dat rechtstreeks mails de deur uit doet is precies wat je niet wil hebben
 * staan als het een keer iets verkeerds schrijft.
 */
export async function generateMailDraft(
  _previous: MailDraftState,
  formData: FormData
): Promise<MailDraftState> {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      leadId: idSchema,
      useWebsite: z.string().optional(),
      snippetId: z.string().cuid().optional().or(z.literal("")),
    })
    .parse(formObject(formData));

  const [lead, settings, snippet, products, style] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        name: true,
        city: true,
        province: true,
        category: true,
        website: true,
        hasVending: true,
        vendingDetail: true,
        nearbyVending: true,
        sellsTakeaway: true,
        outreachPrep: true,
        ownerId: true,
        owner: { select: { name: true } },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: "default" } }),
    input.snippetId
      ? prisma.mailSnippet.findUnique({
          where: { id: input.snippetId },
          select: { id: true, body: true },
        })
      : Promise.resolve(null),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ line: "asc" }, { name: "asc" }],
      select: {
        name: true,
        line: true,
        listPrice: true,
        description: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        mailStyleNotes: true,
        mailExamples: {
          where: { approved: true },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { subject: true, body: true },
        },
      },
    }),
  ]);

  if (!lead) return { error: "Lead niet gevonden" };
  if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
    return { error: `Deze lead staat op naam van ${lead.owner?.name ?? "een collega"}` };
  }

  const websiteText =
    input.useWebsite === "on" && lead.website
      ? await fetchWebsiteText(lead.website)
      : null;

  const prompt = buildMailPrompt({
    lead,
    senderName: user.name,
    businessName: settings?.businessName || "MATO",
    websiteText,
    snippetBody: snippet?.body,
    catalogBlock: catalogPromptBlock(products),
    machineHint: suggestMachineHint(lead),
    proposalText: lead.outreachPrep,
    styleRules: style?.mailStyleNotes,
    styleExamples: style?.mailExamples,
  });

  try {
    const draft = await draftMail({
      apiKey: readSettingSecret(settings?.anthropicApiKey),
      model: settings?.anthropicModel || "claude-opus-5",
      system: SYSTEM_PROMPT,
      prompt,
    });

    const saved = await prisma.emailDraft.create({
      data: {
        leadId: lead.id,
        subject: draft.subject,
        body: draft.body,
        status: "PREPARED",
        createdById: user.id,
        source: "AI",
        sourceSnippetId: snippet?.id,
      },
    });

    await audit(user.id, "mail.drafted", "lead", lead.id, {
      draftId: saved.id,
      usedWebsite: Boolean(websiteText),
      usedSnippet: Boolean(snippet),
    });

    revalidatePath(`/leads/${lead.id}`);
    return { subject: draft.subject, body: draft.body, draftId: saved.id };
  } catch (err) {
    if (err instanceof AnthropicConfigError || err instanceof SecretError) {
      return { error: err.message };
    }
    throw err;
  }
}

/**
 * Zoekt een concept op en controleert of deze medewerker eraan mag komen.
 *
 * Eén plek, omdat de regel op vier plekken gold en op twee ervan ontbrak: een
 * collega kon de tekst van andermans lead herschrijven of weggooien. Die tekst
 * vertrekt daarna uit het postvak van de eigenaar, die alleen ziet dat er
 * "nagelezen" bij staat.
 */
async function draftForUser(
  draftId: string,
  user: { id: string; role: string }
): Promise<
  | { ok: true; draft: { id: string; leadId: string; status: string; leadOwnerId: string | null } }
  | { ok: false; error: string }
> {
  const draft = await prisma.emailDraft.findUnique({
    where: { id: draftId },
    select: {
      id: true,
      leadId: true,
      status: true,
      lead: { select: { ownerId: true, owner: { select: { name: true } } } },
    },
  });
  if (!draft) return { ok: false, error: "Dit concept bestaat niet meer" };

  if (draft.lead.ownerId && draft.lead.ownerId !== user.id && user.role !== "admin") {
    return {
      ok: false,
      error: `Deze lead staat op naam van ${draft.lead.owner?.name ?? "een collega"}`,
    };
  }

  return {
    ok: true,
    draft: {
      id: draft.id,
      leadId: draft.leadId,
      status: draft.status,
      leadOwnerId: draft.lead.ownerId,
    },
  };
}

/** Bewaart de door de medewerker bijgewerkte tekst. */
export async function saveMailDraft(
  _previous: MailSendState,
  formData: FormData
): Promise<MailSendState> {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      draftId: idSchema,
      subject: z.string().trim().min(1).max(300),
      body: z.string().trim().min(1).max(20_000),
    })
    .parse(formObject(formData));

  const found = await draftForUser(input.draftId, user);
  if (!found.ok) return { error: found.error };

  // Een verstuurde mail is geschiedenis, geen klad meer.
  if (found.draft.status === "SENT") {
    return { error: "Deze mail is al verstuurd en kan niet meer aangepast worden." };
  }

  await prisma.emailDraft.update({
    where: { id: input.draftId },
    data: {
      subject: input.subject,
      body: input.body,
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  await audit(user.id, "mail.approved", "lead", found.draft.leadId, {
    draftId: input.draftId,
  });
  revalidatePath(`/leads/${found.draft.leadId}`);
  return { saved: true };
}

/**
 * Verstuurt een nagelezen concept vanuit het eigen postvak.
 *
 * De tekst die verstuurd wordt is de tekst uit het formulier, niet die uit de
 * database: anders gaat een laatste aanpassing die nog niet opgeslagen was
 * verloren en vertrekt er iets anders dan wat op het scherm stond.
 */
export async function sendMailDraft(
  _previous: MailSendState,
  formData: FormData
): Promise<MailSendState> {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      draftId: idSchema,
      subject: z.string().trim().min(1, "Onderwerp ontbreekt").max(300),
      body: z.string().trim().min(1, "De mail is leeg").max(20_000),
      to: z.string().trim().email("Geen geldig mailadres"),
    })
    .safeParse(formObject(formData));

  if (!input.success) {
    return { error: input.error.issues[0]?.message ?? "Controleer de gegevens" };
  }

  const found = await draftForUser(input.data.draftId, user);
  if (!found.ok) return { error: found.error };
  const draft = found.draft;

  /**
   * Claim het concept vóór het versturen, in één statement.
   *
   * `updateMany` geeft terug hoeveel rijen het raakte, dus wie de wedstrijd
   * verliest weet dat ook. Nodig tegen dubbel klikken, tegen de terugknop, en
   * tegen een collega die hetzelfde concept openhad: de prospect twee keer
   * dezelfde mail sturen is geen kleinigheid.
   */
  const claimed = await prisma.emailDraft.updateMany({
    where: { id: draft.id, status: { not: "SENT" } },
    data: { status: "SENDING" },
  });
  if (claimed.count !== 1) {
    return { error: "Deze mail is al verstuurd." };
  }

  let sent;
  try {
    const token = await accessTokenFor(user.id);
    sent = await sendMail({
      accessToken: token,
      to: input.data.to,
      subject: input.data.subject,
      body: input.data.body,
    });
  } catch (err) {
    // Niets vertrokken: het concept mag terug in de wachtrij.
    await prisma.emailDraft
      .updateMany({ where: { id: draft.id, status: "SENDING" }, data: { status: "APPROVED" } })
      .catch(() => {});
    if (
      err instanceof MailboxError ||
      err instanceof GraphError ||
      err instanceof SecretError
    ) {
      return { error: err.message };
    }
    throw err;
  }

  // Vanaf hier heeft de klant de mail. Wat hierna misgaat mag nooit als
  // "niet verstuurd" op het scherm komen — dan stuurt de medewerker hem
  // opnieuw en krijgt de klant hem twee keer.
  try {
    await prisma.mailMessage.create({
      data: {
        leadId: draft.leadId,
        userId: user.id,
        direction: "OUT",
        folder: "SENT",
        subject: input.data.subject,
        body: input.data.body,
        // Het adres van het eigen postvak is betrouwbaarder dan wat Graph
        // terugkaatst op een net aangemaakt concept.
        fromAddress: sent.from,
        toAddress: input.data.to,
        occurredAt: sent.sentAt,
        graphMessageId: sent.graphMessageId,
        conversationId: sent.conversationId,
        draftId: draft.id,
        matchedBy: "afzender",
        matchConfidence: 1,
      },
    });

    // Los van elkaar, en niet in één transactie: een verwijderd concept mag
    // het bewijs van de verstuurde mail niet mee terugdraaien.
    await prisma.emailDraft.updateMany({
      where: { id: draft.id },
      data: {
        subject: input.data.subject,
        body: input.data.body,
        status: "SENT",
        approvedAt: new Date(),
      },
    });
    await prisma.lead.update({
      where: { id: draft.leadId },
      data: { lastTouchedAt: sent.sentAt },
    });
    await audit(user.id, "mail.sent", "lead", draft.leadId, {
      draftId: draft.id,
      to: input.data.to,
    });

    // Los van het versturen zelf: een eerste mail start de opvolgreeks, maar
    // mag het "verstuurd"-scherm niet laten falen als dit ergens op stuit.
    await enrollLeadFollowup(draft.leadId, draft.leadOwnerId ?? user.id).catch((err) =>
      console.error("kon niet inschrijven voor opvolgreeks", err)
    );

    revalidatePath(`/leads/${draft.leadId}`);
    revalidatePath("/taken");
    return { sent: true, to: input.data.to };
  } catch (err) {
    console.error("mail verstuurd maar niet vastgelegd", err);
    revalidatePath(`/leads/${draft.leadId}`);
    // Bewust sent: true — de klant heeft hem echt.
    return {
      sent: true,
      to: input.data.to,
      warning:
        "De mail is verstuurd, maar kon niet in de geschiedenis gezet worden. Noteer hem zelf even en stuur hem niet opnieuw.",
    };
  }
}

/**
 * Haalt nieuwe mail op (Postvak IN + Verzonden) en zet ze bij de juiste lead.
 *
 * Handmatig vanaf de leadfiche; de cron doet hetzelfde op de achtergrond.
 */
export async function syncReplies(): Promise<MailSyncState> {
  const user = await requireUser(["admin", "sales"]);

  const result = await syncMailboxForUser(user.id, {
    asAdmin: user.role === "admin",
  });

  if (result.error) {
    return { error: result.error };
  }

  if (result.added || result.unmatched) {
    await audit(user.id, "mail.replies_synced", "user", user.id, {
      added: result.added,
      unmatched: result.unmatched,
    });
    revalidatePath("/leads");
    revalidatePath("/taken");
    revalidatePath("/");
  }

  return {
    checked: true,
    added: result.added,
    unmatched: result.unmatched,
    failed: result.failed,
    truncated: result.truncated,
  };
}

/** Verbreekt de koppeling; de tokens worden verwijderd, de geschiedenis blijft. */
export async function disconnectMailboxAction() {
  const user = await requireUser(["admin", "sales"]);
  await disconnectMailbox(user.id);
  await audit(user.id, "mailbox.disconnect", "user", user.id);
  revalidatePath("/settings");
}

export async function deleteMailDraft(draftId: string): Promise<MailSendState> {
  const user = await requireUser(["admin", "sales"]);
  const id = idSchema.parse(draftId);

  const found = await draftForUser(id, user);
  if (!found.ok) return { error: found.error };

  // Een verstuurde mail weggooien zou de geschiedenis van de lead uithollen.
  if (found.draft.status === "SENT") {
    return { error: "Een verstuurde mail hoort bij de geschiedenis en blijft staan." };
  }

  await prisma.emailDraft.delete({ where: { id } });
  await audit(user.id, "mail.discarded", "lead", found.draft.leadId, { draftId: id });
  revalidatePath(`/leads/${found.draft.leadId}`);
  return {};
}
