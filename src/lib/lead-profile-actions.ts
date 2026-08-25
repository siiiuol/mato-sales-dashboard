"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { completeJson, AnthropicConfigError } from "./anthropic";
import { prisma } from "./db";
import { requireUser } from "./dal";
import {
  buildLeadProfilePatch,
  buildLeadProfilePrompt,
  LEAD_PROFILE_SCHEMA,
  LEAD_PROFILE_SYSTEM,
  parseLeadProfileDraft,
  type LeadProfileDraft,
} from "./lead-profile";
import {
  fetchPlacesProfile,
  PlacesProfileError,
  type PlacesProfile,
} from "./places-profile";
import { readSettingSecret } from "./settings-secrets";
import { formObject, idSchema } from "./validation";
import {
  fetchWebsiteResearch,
  WebsiteResearchError,
  type WebsiteResearch,
} from "./website-research";

export type LeadProfileActionState = {
  error?: string;
  enriched?: boolean;
  warnings?: string[];
  sources?: string[];
};

function message(error: unknown, fallback: string): string {
  if (
    error instanceof WebsiteResearchError ||
    error instanceof PlacesProfileError ||
    error instanceof AnthropicConfigError
  ) {
    return error.message;
  }
  return fallback;
}

function sameWebsite(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return (
      a.hostname.replace(/^www\./i, "").toLowerCase() ===
      b.hostname.replace(/^www\./i, "").toLowerCase()
    );
  } catch {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
}

export async function enrichLeadProfile(
  _previous: LeadProfileActionState,
  formData: FormData
): Promise<LeadProfileActionState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const { leadId } = z.object({ leadId: idSchema }).parse(formObject(formData));
    const [lead, settings] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        include: { owner: { select: { name: true } } },
      }),
      prisma.appSettings.findUnique({
        where: { id: "default" },
        select: {
          placesApiKey: true,
          anthropicApiKey: true,
          anthropicModel: true,
        },
      }),
    ]);
    if (!lead) return { error: "Lead niet gevonden." };
    if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
      return {
        error: `Deze lead staat op naam van ${lead.owner?.name ?? "een collega"}.`,
      };
    }

    const warnings: string[] = [];
    const placesKey = readSettingSecret(settings?.placesApiKey);
    const anthropicKey = readSettingSecret(settings?.anthropicApiKey);
    const placesPromise = placesKey
      ? fetchPlacesProfile(lead, placesKey)
      : Promise.resolve<PlacesProfile | null>(null);
    const websitePromise = lead.website
      ? fetchWebsiteResearch(lead.website)
      : Promise.resolve<WebsiteResearch | null>(null);
    const [placesResult, websiteResult] = await Promise.allSettled([
      placesPromise,
      websitePromise,
    ]);

    let places: PlacesProfile | null = null;
    if (placesResult.status === "fulfilled") {
      places = placesResult.value;
      if (!places && placesKey) warnings.push("Geen passende zaak gevonden in Google Places.");
    } else {
      warnings.push(message(placesResult.reason, "Google Places kon niet worden opgehaald."));
    }
    if (!placesKey) warnings.push("Google Places is niet ingesteld.");

    let website: WebsiteResearch | null = null;
    if (websiteResult.status === "fulfilled") {
      website = websiteResult.value;
    } else {
      warnings.push(message(websiteResult.reason, "De website kon niet worden opgehaald."));
    }

    // Bij een OSM-lead is de website vaak pas na de gerichte Places-match bekend.
    if (
      places?.website &&
      (!lead.website || !sameWebsite(lead.website, places.website)) &&
      (!website || !sameWebsite(website.url, places.website))
    ) {
      try {
        website = await fetchWebsiteResearch(places.website);
      } catch (error) {
        warnings.push(message(error, "De website uit Google Places kon niet worden opgehaald."));
      }
    }

    if (!website && !places) {
      return {
        error:
          "Er kon geen externe bedrijfsinformatie worden opgehaald. Controleer de website en Places-instellingen.",
        warnings,
      };
    }

    let draft: LeadProfileDraft | null = null;
    try {
      const content = await completeJson({
        apiKey: anthropicKey,
        model: settings?.anthropicModel || "claude-opus-5",
        system: LEAD_PROFILE_SYSTEM,
        prompt: buildLeadProfilePrompt({ lead, website, places }),
        schema: LEAD_PROFILE_SCHEMA,
      });
      draft = parseLeadProfileDraft(content);
    } catch (error) {
      warnings.push(
        `${message(error, "De AI-samenvatting kon niet worden gemaakt.")} De brongegevens zijn wel bewaard.`
      );
    }

    const now = new Date();
    const patch = buildLeadProfilePatch({ lead, website, places, draft, now });
    const sources = [
      website ? "Website" : null,
      places ? "Google Places" : null,
      draft ? "Anthropic-samenvatting" : null,
    ].filter((source): source is string => Boolean(source));

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: patch,
      }),
      prisma.auditEvent.create({
        data: {
          actorId: user.id,
          action: "lead.profile_enriched",
          entityType: "lead",
          entityId: lead.id,
          detail: JSON.stringify({
            sources,
            warnings,
            websitePages: website?.pages.length ?? 0,
            placesLookup: places?.source ?? null,
            updatedFields: Object.keys(patch),
          }),
        },
      }),
    ]);

    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/");
    revalidatePath("/bellen");
    return { enriched: true, warnings, sources };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Ongeldige invoer." };
    return {
      error: error instanceof Error ? error.message : "Profiel verrijken mislukt.",
    };
  }
}
