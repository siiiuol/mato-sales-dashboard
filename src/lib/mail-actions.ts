"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { buildMailPrompt, SYSTEM_PROMPT } from "./mail-prompt";
import { draftMail, AnthropicConfigError } from "./anthropic";
import { formObject, idSchema } from "./validation";

export type MailDraftState = {
  error?: string;
  subject?: string;
  body?: string;
  draftId?: string;
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
