"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { AnthropicConfigError, completeJson } from "./anthropic";
import { logContactForLead } from "./contact-log";
import { formObject, idSchema } from "./validation";
import { statusLabel } from "./constants";
import { readSettingSecret } from "./settings-secrets";
import {
  AIOS_SYSTEM,
  BRIEF_SCHEMA,
  CONTENT_SCHEMA,
  OCHTENDBRIEF_SCHEMA,
  VOORSTEL_SCHEMA,
  buildBriefPrompt,
  buildContentIdeasPrompt,
  buildOchtendbriefPrompt,
  buildVoorstelPrompt,
  type AiosLead,
} from "./aios-prompt";

async function anthropicSettings() {
  const settings = await prisma.appSettings.findFirst({
    select: { anthropicApiKey: true, anthropicModel: true, businessName: true },
  });
  return {
    apiKey: readSettingSecret(settings?.anthropicApiKey),
    model: settings?.anthropicModel || "claude-opus-5",
    businessName: settings?.businessName?.trim() || "MATO",
  };
}

function stripJson(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseObject(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJson(content));
  } catch {
    throw new AnthropicConfigError(
      "Het antwoord van Anthropic was geen geldige JSON."
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new AnthropicConfigError("Het antwoord van Anthropic had de verkeerde vorm.");
  }
  return parsed as Record<string, unknown>;
}

function str(record: Record<string, unknown>, key: string): string {
  const v = record[key];
  return typeof v === "string" ? v.trim() : "";
}

export type AiosTextState = {
  error?: string;
  markdown?: string;
  focus?: string;
  dealPath?: string;
  title?: string;
  angle?: string;
  questions?: string;
  objections?: string;
  nextStep?: string;
  saved?: boolean;
};

function toAiosLead(lead: {
  name: string;
  city: string | null;
  province: string | null;
  category: string | null;
  website: string | null;
  hasVending: boolean;
  vendingDetail: string | null;
  nearbyVending: number;
  sellsTakeaway: boolean;
  phone: string | null;
  email: string | null;
  status: string;
  nextActionAt: Date | null;
  outreach: Array<{ note: string | null }>;
}): AiosLead {
  return {
    name: lead.name,
    city: lead.city,
    province: lead.province,
    category: lead.category,
    website: lead.website,
    hasVending: lead.hasVending,
    vendingDetail: lead.vendingDetail,
    nearbyVending: lead.nearbyVending,
    sellsTakeaway: lead.sellsTakeaway,
    phone: lead.phone,
    email: lead.email,
    status: statusLabel(lead.status),
    nextActionAt: lead.nextActionAt
      ? lead.nextActionAt.toLocaleString("nl-BE")
      : null,
    lastNote: lead.outreach[0]?.note ?? null,
  };
}

/**
 * Pre-contact brief voor één lead. Niets wordt verstuurd; opslaan is apart.
 */
export async function generateLeadBrief(
  _previous: AiosTextState,
  formData: FormData
): Promise<AiosTextState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const { leadId } = z.object({ leadId: idSchema }).parse(formObject(formData));
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        outreach: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { note: true },
        },
      },
    });
    if (!lead) return { error: "Lead niet gevonden" };

    const { apiKey, model } = await anthropicSettings();
    const content = await completeJson({
      apiKey,
      model,
      system: AIOS_SYSTEM,
      prompt: buildBriefPrompt(toAiosLead(lead), user.name),
      schema: BRIEF_SCHEMA,
    });
    const record = parseObject(content);
    const markdown = str(record, "markdown");
    if (!markdown) {
      return { error: "Het antwoord miste de brieftekst." };
    }
    return {
      markdown,
      dealPath: str(record, "dealPath"),
      angle: str(record, "angle"),
      questions: str(record, "questions"),
      objections: str(record, "objections"),
      nextStep: str(record, "nextStep"),
    };
  } catch (err) {
    if (err instanceof AnthropicConfigError) return { error: err.message };
    if (err instanceof z.ZodError) return { error: "Ongeldige invoer" };
    return { error: err instanceof Error ? err.message : "Opstellen mislukt" };
  }
}

/**
 * Schrijft brief terug op de fiche: velden + korte notitie in de tijdlijn.
 */
export async function saveLeadBrief(
  _previous: AiosTextState,
  formData: FormData
): Promise<AiosTextState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const parsed = z
      .object({
        leadId: idSchema,
        markdown: z.string().trim().min(1).max(20_000),
        dealPath: z.string().trim().max(40).optional(),
        angle: z.string().trim().max(2000).optional(),
        questions: z.string().trim().max(4000).optional(),
        objections: z.string().trim().max(4000).optional(),
        nextStep: z.string().trim().max(1000).optional(),
      })
      .parse(formObject(formData));

    await prisma.lead.update({
      where: { id: parsed.leadId },
      data: {
        outreachPrep: parsed.markdown,
        recommendedAngle: parsed.angle || undefined,
        discoveryQuestions: parsed.questions || undefined,
        likelyObjection: parsed.objections || undefined,
      },
    });

    const note = [
      `Assistent-brief${parsed.dealPath ? ` (${parsed.dealPath})` : ""}`,
      parsed.nextStep ? `Volgende stap: ${parsed.nextStep}` : null,
      parsed.angle ? `Invalshoek: ${parsed.angle}` : null,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000);

    await logContactForLead({
      leadId: parsed.leadId,
      type: "NOTE",
      note,
      userId: user.id,
    });

    await audit(user.id, "aios.brief_saved", "lead", parsed.leadId);

    revalidatePath(`/leads/${parsed.leadId}`);
    revalidatePath("/");
    return {
      saved: true,
      markdown: parsed.markdown,
      dealPath: parsed.dealPath,
      angle: parsed.angle,
      questions: parsed.questions,
      objections: parsed.objections,
      nextStep: parsed.nextStep,
    };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: "Ongeldige invoer" };
    return { error: err instanceof Error ? err.message : "Opslaan mislukt" };
  }
}

export async function generateVoorstel(
  _previous: AiosTextState,
  formData: FormData
): Promise<AiosTextState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const { leadId } = z.object({ leadId: idSchema }).parse(formObject(formData));
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        outreach: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { note: true },
        },
      },
    });
    if (!lead) return { error: "Lead niet gevonden" };

    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ line: "asc" }, { name: "asc" }],
      select: { name: true, line: true, listPrice: true },
      take: 40,
    });

    const { apiKey, model } = await anthropicSettings();
    const content = await completeJson({
      apiKey,
      model,
      system: AIOS_SYSTEM,
      prompt: buildVoorstelPrompt(toAiosLead(lead), user.name, products),
      schema: VOORSTEL_SCHEMA,
    });
    const record = parseObject(content);
    const markdown = str(record, "markdown");
    if (!markdown) return { error: "Het antwoord miste het voorstel." };
    return {
      markdown,
      dealPath: str(record, "dealPath"),
      title: str(record, "title"),
      nextStep: str(record, "nextStep"),
    };
  } catch (err) {
    if (err instanceof AnthropicConfigError) return { error: err.message };
    if (err instanceof z.ZodError) return { error: "Ongeldige invoer" };
    return { error: err instanceof Error ? err.message : "Opstellen mislukt" };
  }
}

export async function saveVoorstel(
  _previous: AiosTextState,
  formData: FormData
): Promise<AiosTextState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const parsed = z
      .object({
        leadId: idSchema,
        markdown: z.string().trim().min(1).max(20_000),
        dealPath: z.string().trim().max(40).optional(),
        title: z.string().trim().max(200).optional(),
        nextStep: z.string().trim().max(1000).optional(),
      })
      .parse(formObject(formData));

    const deal = await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: parsed.leadId },
        data: {
          outreachPrep: parsed.markdown,
          status: "NEGOTIATION",
          ownerId: user.id,
          ownedAt: new Date(),
          lastTouchedAt: new Date(),
        },
      });
      const existing = await tx.deal.findFirst({
        where: {
          leadId: parsed.leadId,
          stage: { in: ["QUALIFIED", "PROPOSAL", "NEGOTIATION"] },
        },
        orderBy: { updatedAt: "desc" },
      });
      return existing
        ? tx.deal.update({
            where: { id: existing.id },
            data: {
              stage: "PROPOSAL",
              title: parsed.title || existing.title,
              nextStep: parsed.nextStep || existing.nextStep,
              ownerId: existing.ownerId ?? user.id,
              lastActivityAt: new Date(),
            },
          })
        : tx.deal.create({
            data: {
              leadId: parsed.leadId,
              ownerId: user.id,
              stage: "PROPOSAL",
              title: parsed.title || "Voorstel",
              nextStep: parsed.nextStep || null,
              lastActivityAt: new Date(),
            },
          });
    });

    const note = [
      `Assistent-voorstel${parsed.title ? `: ${parsed.title}` : ""}`,
      parsed.dealPath ? `Pad: ${parsed.dealPath}` : null,
      parsed.nextStep ? `Volgende stap: ${parsed.nextStep}` : null,
      "(Volledige tekst staat onder Aanpak / outreach-prep op de fiche.)",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000);

    await logContactForLead({
      leadId: parsed.leadId,
      type: "NOTE",
      note,
      userId: user.id,
    });

    await audit(user.id, "aios.voorstel_saved", "lead", parsed.leadId, {
      dealId: deal.id,
      dealPath: parsed.dealPath,
    });

    revalidatePath(`/leads/${parsed.leadId}`);
    return {
      saved: true,
      markdown: parsed.markdown,
      dealPath: parsed.dealPath,
      title: parsed.title,
      nextStep: parsed.nextStep,
    };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: "Ongeldige invoer" };
    return { error: err instanceof Error ? err.message : "Opslaan mislukt" };
  }
}

const OPEN_STATUSES = ["NEW", "TO_CALL", "CONTACTED", "FOLLOW_UP", "NEGOTIATION"];

export async function generateOchtendbrief(
  _previous: AiosTextState,
  _formData: FormData
): Promise<AiosTextState> {
  void _previous;
  void _formData;
  try {
    const user = await requireUser(["admin", "sales"]);
    const now = new Date();
    const fortnight = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [leads, tasks] = await Promise.all([
      prisma.lead.findMany({
        where: { ownerId: user.id, status: { in: OPEN_STATUSES } },
        orderBy: [{ nextActionAt: "asc" }, { score: "desc" }],
        take: 40,
        select: {
          name: true,
          city: true,
          category: true,
          status: true,
          phone: true,
          nextActionAt: true,
          hasVending: true,
          nearbyVending: true,
          sellsTakeaway: true,
          outreach: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      prisma.task.findMany({
        where: {
          assignedToId: user.id,
          status: "OPEN",
          OR: [{ dueAt: null }, { dueAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } }],
        },
        orderBy: { dueAt: "asc" },
        take: 20,
        select: {
          title: true,
          dueAt: true,
          lead: { select: { name: true } },
        },
      }),
    ]);

    if (leads.length === 0 && tasks.length === 0) {
      return {
        markdown:
          "## Ochtendbrief\n\nGeen open leads of taken op jouw naam. Claim leads onder **Mijn leads** of **Leads**.",
        focus: "Geen open werk — claim eerst leads.",
      };
    }

    const { apiKey, model } = await anthropicSettings();
    const content = await completeJson({
      apiKey,
      model,
      system: AIOS_SYSTEM,
      prompt: buildOchtendbriefPrompt({
        senderName: user.name,
        leads: leads.map((l) => ({
          name: l.name,
          city: l.city,
          category: l.category,
          status: statusLabel(l.status),
          phone: l.phone,
          nextActionAt: l.nextActionAt
            ? l.nextActionAt.toLocaleString("nl-BE")
            : null,
          lastContact: l.outreach[0]?.createdAt
            ? l.outreach[0].createdAt.toLocaleDateString("nl-BE")
            : null,
          hasVending: l.hasVending,
          nearbyVending: l.nearbyVending,
          sellsTakeaway: l.sellsTakeaway,
        })),
        tasks: tasks.map((t) => ({
          title: t.title,
          dueAt: t.dueAt ? t.dueAt.toLocaleString("nl-BE") : null,
          leadName: t.lead?.name ?? null,
        })),
      }),
      schema: OCHTENDBRIEF_SCHEMA,
    });
    const record = parseObject(content);
    const markdown = str(record, "markdown");
    if (!markdown) return { error: "Het antwoord miste de ochtendbrief." };

    // Stale-hint blijft lokaal bruikbaar ook als het model ze mist.
    const staleCount = leads.filter((l) => {
      const last = l.outreach[0]?.createdAt;
      return !last || last < fortnight;
    }).length;

    await audit(user.id, "aios.ochtendbrief", "user", user.id, {
      leads: leads.length,
      tasks: tasks.length,
      staleCount,
    });

    return {
      markdown,
      focus: str(record, "focus"),
    };
  } catch (err) {
    if (err instanceof AnthropicConfigError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Opstellen mislukt" };
  }
}

export async function generateContentIdeas(
  _previous: AiosTextState,
  _formData: FormData
): Promise<AiosTextState> {
  void _previous;
  void _formData;
  try {
    await requireUser(["admin", "sales"]);
    const { apiKey, model } = await anthropicSettings();
    const content = await completeJson({
      apiKey,
      model,
      system: AIOS_SYSTEM,
      prompt: buildContentIdeasPrompt(),
      schema: CONTENT_SCHEMA,
    });
    const record = parseObject(content);
    const markdown = str(record, "markdown");
    if (!markdown) return { error: "Het antwoord miste de ideeën." };
    return { markdown };
  } catch (err) {
    if (err instanceof AnthropicConfigError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Opstellen mislukt" };
  }
}
