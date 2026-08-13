"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { buildMailPrompt, SYSTEM_PROMPT } from "./mail-prompt";
import { draftMail, AnthropicConfigError } from "./anthropic";
import { formObject, idSchema } from "./validation";
import { accessTokenFor, disconnectMailbox, MailboxError } from "./mailbox";
import { fetchInbox, GraphError, sendMail } from "./graph";
import { matchReplies, normaliseAddress } from "./reply-match";

export type MailDraftState = {
  error?: string;
  subject?: string;
  body?: string;
  draftId?: string;
};

export type MailSendState = {
  error?: string;
  sent?: boolean;
  to?: string;
};

export type MailSyncState = {
  error?: string;
  checked?: boolean;
  added?: number;
};

/**
 * Haalt wat leesbare tekst van de website van de prospect.
 *
 * Best effort: een onbereikbare of trage site mag het opstellen van de mail
 * niet tegenhouden. Alleen http en https, kort wachten, en er gaat een harde
 * limiet op wat er terugkomt zodat één zware pagina niet het hele geheugen
 * opsnoept.
 *
 * De inhoud is van een derde en wordt in de opdracht uitdrukkelijk als naslag
 * gemarkeerd — zie `buildMailPrompt`.
 */
async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const response = await fetch(parsed.toString(), {
      headers: { "user-agent": "MATO-Dashboard/1.0 (+lead research)" },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return null;

    const html = (await response.text()).slice(0, 200_000);
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);
  } catch {
    return null;
  }
}

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
    .object({ leadId: idSchema, useWebsite: z.string().optional() })
    .parse(formObject(formData));

  const [lead, settings] = await Promise.all([
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
        ownerId: true,
        owner: { select: { name: true } },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: "default" } }),
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
  });

  try {
    const draft = await draftMail({
      apiKey: settings?.anthropicApiKey ?? "",
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
      },
    });

    await audit(user.id, "mail.drafted", "lead", lead.id, {
      draftId: saved.id,
      usedWebsite: Boolean(websiteText),
    });

    revalidatePath(`/leads/${lead.id}`);
    return { subject: draft.subject, body: draft.body, draftId: saved.id };
  } catch (err) {
    if (err instanceof AnthropicConfigError) return { error: err.message };
    throw err;
  }
}

/** Bewaart de door de medewerker bijgewerkte tekst. */
export async function saveMailDraft(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      draftId: idSchema,
      subject: z.string().trim().min(1).max(300),
      body: z.string().trim().min(1).max(20_000),
    })
    .parse(formObject(formData));

  const draft = await prisma.emailDraft.update({
    where: { id: input.draftId },
    data: { subject: input.subject, body: input.body, status: "APPROVED", approvedAt: new Date() },
    select: { leadId: true },
  });

  await audit(user.id, "mail.approved", "lead", draft.leadId, {
    draftId: input.draftId,
  });
  revalidatePath(`/leads/${draft.leadId}`);
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

  const draft = await prisma.emailDraft.findUnique({
    where: { id: input.data.draftId },
    select: { id: true, leadId: true, lead: { select: { ownerId: true, owner: { select: { name: true } } } } },
  });
  if (!draft) return { error: "Dit concept bestaat niet meer" };

  // Dezelfde regel als bij het opstellen: aan andermans lead raak je niet.
  if (
    draft.lead.ownerId &&
    draft.lead.ownerId !== user.id &&
    user.role !== "admin"
  ) {
    return {
      error: `Deze lead staat op naam van ${draft.lead.owner?.name ?? "een collega"}`,
    };
  }

  try {
    const token = await accessTokenFor(user.id);
    const sent = await sendMail({
      accessToken: token,
      to: input.data.to,
      subject: input.data.subject,
      body: input.data.body,
    });

    // Vanaf hier is de mail de deur uit. Wat hierna misgaat mag geen fout aan
    // de medewerker tonen die suggereert dat er niets verstuurd is.
    await prisma.$transaction([
      prisma.mailMessage.create({
        data: {
          leadId: draft.leadId,
          userId: user.id,
          direction: "OUT",
          subject: input.data.subject,
          body: input.data.body,
          fromAddress: sent.from,
          toAddress: input.data.to,
          occurredAt: sent.sentAt,
          graphMessageId: sent.graphMessageId,
          conversationId: sent.conversationId,
          draftId: draft.id,
        },
      }),
      prisma.emailDraft.update({
        where: { id: draft.id },
        data: {
          subject: input.data.subject,
          body: input.data.body,
          status: "SENT",
          approvedAt: new Date(),
        },
      }),
      // Bewust géén OutreachEvent erbij: MailMessage legt dezelfde gebeurtenis
      // vast met meer erin (adressen, gesprek, volledige tekst). Twee rijen voor
      // één mail zou hem ook twee keer op de tijdlijn zetten.
      prisma.lead.update({
        where: { id: draft.leadId },
        data: { lastTouchedAt: sent.sentAt },
      }),
    ]);

    await audit(user.id, "mail.sent", "lead", draft.leadId, {
      draftId: draft.id,
      to: input.data.to,
    });

    revalidatePath(`/leads/${draft.leadId}`);
    return { sent: true, to: input.data.to };
  } catch (err) {
    if (err instanceof MailboxError || err instanceof GraphError) {
      return { error: err.message };
    }
    throw err;
  }
}

/**
 * Haalt nieuwe antwoorden op en zet ze bij de juiste lead.
 *
 * Handmatig aangeroepen vanaf de leadfiche. Een achtergrondtaak zou netter
 * zijn, maar die vraagt een planner die er nog niet is; zo werkt het al wel.
 */
export async function syncReplies(): Promise<MailSyncState> {
  const user = await requireUser(["admin", "sales"]);

  const connection = await prisma.mailboxConnection.findUnique({
    where: { userId: user.id },
    select: { createdAt: true },
  });
  if (!connection) {
    return { error: "Je mailbox is nog niet gekoppeld." };
  }

  // Niet verder terugkijken dan de koppeling bestaat, en niet verder dan een
  // maand: alles daarvoor is oude post die niemand op de tijdlijn verwacht.
  const lastStored = await prisma.mailMessage.findFirst({
    where: { userId: user.id, direction: "IN" },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since = new Date(
    Math.max(
      lastStored?.occurredAt.getTime() ?? 0,
      connection.createdAt.getTime(),
      monthAgo.getTime()
    )
  );

  try {
    const token = await accessTokenFor(user.id);
    const incoming = await fetchInbox({ accessToken: token, since });
    if (!incoming.length) return { checked: true, added: 0 };

    // De koppeltabellen: welke gesprekken van ons zijn, en welke leads welk
    // mailadres hebben.
    const [ourMessages, leadsWithEmail] = await Promise.all([
      prisma.mailMessage.findMany({
        where: { conversationId: { not: null } },
        select: { conversationId: true, leadId: true },
      }),
      prisma.lead.findMany({
        where: { email: { not: null } },
        select: { id: true, email: true },
      }),
    ]);

    const known = await prisma.mailMessage.findMany({
      where: { graphMessageId: { in: incoming.map((m) => m.graphMessageId) } },
      select: { graphMessageId: true },
    });

    const matches = matchReplies(incoming, {
      conversationLeads: new Map(
        ourMessages
          .filter((m): m is typeof m & { conversationId: string } =>
            Boolean(m.conversationId)
          )
          .map((m) => [m.conversationId, m.leadId])
      ),
      leadEmails: new Map(
        leadsWithEmail
          .filter((l) => l.email)
          .map((l) => [normaliseAddress(l.email as string), l.id])
      ),
      knownMessageIds: new Set(
        known.map((m) => m.graphMessageId).filter((id): id is string => Boolean(id))
      ),
    });

    if (!matches.length) return { checked: true, added: 0 };

    const byId = new Map(incoming.map((m) => [m.graphMessageId, m]));
    let added = 0;
    const touched = new Set<string>();

    for (const match of matches) {
      const message = byId.get(match.graphMessageId);
      if (!message) continue;
      try {
        await prisma.mailMessage.create({
          data: {
            leadId: match.leadId,
            userId: user.id,
            direction: "IN",
            subject: message.subject,
            body: message.body.slice(0, 20_000),
            fromAddress: message.from,
            toAddress: message.to,
            occurredAt: message.receivedAt,
            graphMessageId: message.graphMessageId,
            conversationId: message.conversationId,
          },
        });
        added++;
        touched.add(match.leadId);
      } catch {
        // Unieke sleutel op graphMessageId: twee rondes tegelijk kunnen
        // hetzelfde antwoord willen opslaan. De tweede verliest, en dat is de
        // bedoeling.
      }
    }

    for (const leadId of touched) revalidatePath(`/leads/${leadId}`);
    if (added) await audit(user.id, "mail.replies_synced", "user", user.id, { added });

    return { checked: true, added };
  } catch (err) {
    if (err instanceof MailboxError || err instanceof GraphError) {
      return { error: err.message };
    }
    throw err;
  }
}

/** Verbreekt de koppeling; de tokens worden verwijderd, de geschiedenis blijft. */
export async function disconnectMailboxAction() {
  const user = await requireUser(["admin", "sales"]);
  await disconnectMailbox(user.id);
  await audit(user.id, "mailbox.disconnect", "user", user.id);
  revalidatePath("/settings");
}

export async function deleteMailDraft(draftId: string) {
  const user = await requireUser(["admin", "sales"]);
  const id = idSchema.parse(draftId);
  const draft = await prisma.emailDraft.delete({
    where: { id },
    select: { leadId: true },
  });
  await audit(user.id, "mail.discarded", "lead", draft.leadId, { draftId: id });
  revalidatePath(`/leads/${draft.leadId}`);
}
