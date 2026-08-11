"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { runDetection } from "./detection";
import { FLANDERS_ZONES } from "./constants";
import type { LeadStatus } from "./types";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { claimableWhere } from "./claims";
import { callOutcomeSchema, formObject, idSchema } from "./validation";

const optionalId = z.string().cuid().optional().or(z.literal(""));

async function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export async function scanZone(zone: string) {
  await requireUser(["admin", "sales", "reviewer"]);
  if (!FLANDERS_ZONES.includes(zone as (typeof FLANDERS_ZONES)[number])) {
    throw new Error("Ongeldige zone");
  }
  const settings = await getSettings();
  const result = await runDetection(prisma, zone, settings);
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/calls");
  return result;
}

/**
 * Zet deze zaak op jouw naam zolang je hem voor je hebt.
 *
 * `updateMany` met de claimvoorwaarde in de `where` is hier het hele punt: de
 * database schrijft alleen als de rij op dát moment nog vrij is, dus twee
 * medewerkers die tegelijk beginnen kunnen niet allebei slagen. Een losse
 * lees-dan-schrijf zou precies dat wél toelaten.
 *
 * Geeft terug of de claim gelukt is; de aanroeper slaat de lead over als niet.
 */
export async function claimLead(leadId: string): Promise<boolean> {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const id = idSchema.parse(leadId);

  const { count } = await prisma.lead.updateMany({
    where: claimableWhere(id, user.id),
    data: { claimedById: user.id, claimedAt: new Date() },
  });
  return count === 1;
}

export async function logCall(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const parsed = z.object({
    leadId: idSchema,
    outcome: callOutcomeSchema,
    note: z.string().trim().max(2000).optional(),
    callbackAt: z.string().optional(),
    nextLeadId: optionalId,
  }).parse(formObject(formData));
  const { leadId, outcome } = parsed;
  const note = parsed.note || null;
  const callbackAt = parsed.callbackAt || "";
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { doNotContact: true, complianceStatus: true, ownerId: true },
  });
  if (!lead) throw new Error("Lead niet gevonden");
  if (lead.doNotContact || lead.complianceStatus === "BLOCKED") {
    throw new Error("Geblokkeerd: deze lead mag niet gecontacteerd worden");
  }

  const nextFollowUpAt =
    outcome === "CALLBACK" && callbackAt ? new Date(callbackAt) : null;

  let status: LeadStatus = "CONTACTED";
  if (outcome === "INTERESTED") status = "NEGOTIATION";
  if (outcome === "NOT_INTERESTED") status = "LOST";
  if (outcome === "CALLBACK" || outcome === "VOICEMAIL" || outcome === "NO_ANSWER") {
    status = "FOLLOW_UP";
  }
  if (outcome === "WRONG_NUMBER") status = "DO_NOT_CONTACT";

  await prisma.outreachEvent.create({
    data: {
      leadId,
      type: "CALL",
      outcome,
      note,
      nextFollowUpAt: nextFollowUpAt ?? undefined,
      createdById: user.id,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      nextActionAt:
        nextFollowUpAt ??
        (status === "FOLLOW_UP" ? new Date(Date.now() + 86400000) : null),
      lastTouchedAt: new Date(),
      // Genoteerd betekent klaar: de claim gaat eraf zodat de lead niet blijft
      // hangen op naam van wie er toevallig het laatst naar keek.
      claimedById: null,
      claimedAt: null,
      // Eigenaar blijft wie er als eerste belde, zodat opvolging bij dezelfde
      // persoon terechtkomt en de klant niet elke keer een andere stem krijgt.
      ownerId: lead.ownerId ?? user.id,
    },
  });
  await audit(user.id, "call.logged", "lead", leadId, { outcome });

  revalidatePath("/calls");
  revalidatePath("/leads");
  revalidatePath("/");
  redirect(parsed.nextLeadId ? `/calls?lead=${parsed.nextLeadId}` : "/calls");
}

export async function createLead(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    name: z.string().trim().min(1).max(300),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(150).optional(),
    province: z.string().trim().max(150).optional(),
    category: z.string().trim().max(150).optional(),
    phone: z.string().trim().max(100).optional(),
    email: z.string().email().optional().or(z.literal("")),
    website: z.string().url().optional().or(z.literal("")),
    score: z.coerce.number().int().min(0).max(100).default(50),
  }).parse(formObject(formData));

  const lead = await prisma.lead.create({
    data: {
      name: input.name,
      address: input.address || null,
      city: input.city || null,
      province: input.province || null,
      category: input.category || null,
      phone: input.phone || null,
      email: input.email || null,
      website: input.website || null,
      source: "manual",
      score: input.score,
      reason: "Manual entry",
      status: "TO_CALL",
      nextActionAt: new Date(),
    },
  });
  await audit(user.id, "lead.created", "lead", lead.id);

  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/");
}

/**
 * Triage: you decided this business is worth a call.
 *
 * Clearing compliance here is what actually makes a scanned lead callable —
 * every call queue filters on `complianceStatus: "CLEARED"`, and the scan
 * creates leads as PENDING.
 */
export async function contactLead(leadId: string) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const id = idSchema.parse(leadId);
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { doNotContact: true, complianceStatus: true },
  });
  if (!lead) throw new Error("Lead niet gevonden");
  if (lead.doNotContact || lead.complianceStatus === "BLOCKED") {
    throw new Error("Geblokkeerd: deze lead mag niet gecontacteerd worden");
  }

  const now = new Date();
  await prisma.lead.update({
    where: { id },
    data: {
      complianceStatus: "CLEARED",
      status: "TO_CALL",
      nextActionAt: now,
      suppressionCheckedAt: now,
    },
  });
  await audit(user.id, "lead.contact_approved", "lead", id);
  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/");
}

/** Triage: not now. Hidden from every queue but never deleted. */
export async function skipLead(leadId: string) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const id = idSchema.parse(leadId);
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!lead) throw new Error("Lead niet gevonden");

  await prisma.lead.update({
    where: { id },
    data: {
      status: "SKIPPED",
      nextActionAt: null,
      lastTouchedAt: new Date(),
      claimedById: null,
      claimedAt: null,
    },
  });
  // Store the previous status so a skip is restorable, not just reversible.
  await audit(user.id, "lead.skipped", "lead", id, { previousStatus: lead.status });
  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/");
}

/**
 * Undo a skip by putting the lead back in front of you to decide again.
 *
 * It returns to triage rather than straight to the call list: setting TO_CALL
 * while compliance is still PENDING satisfies no queue's filter, so the lead
 * would vanish from the app entirely.
 */
export async function unskipLead(leadId: string) {
  const user = await requireUser(["admin", "sales", "reviewer"]);
  const id = idSchema.parse(leadId);
  await prisma.lead.update({
    where: { id },
    data: {
      status: "NEW",
      complianceStatus: "PENDING",
      nextActionAt: null,
      claimedById: null,
      claimedAt: null,
    },
  });
  await audit(user.id, "lead.unskipped", "lead", id);
  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/");
}

export async function saveSettings(formData: FormData) {
  const user = await requireUser(["admin"]);
  const categories = String(formData.get("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const zones = formData.getAll("zones").map(String);

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {
      businessName: String(formData.get("businessName") ?? "MATO"),
      placesApiKey: String(formData.get("placesApiKey") ?? ""),
      detectionCategories: JSON.stringify(categories),
      enabledZones: JSON.stringify(zones.length ? zones : [...FLANDERS_ZONES]),
      exclusionRadiusKm: Number(formData.get("exclusionRadiusKm") ?? 0.5),
      pitchTemplates: String(formData.get("pitchTemplates") ?? "{}"),
    },
    create: {
      id: "default",
      businessName: String(formData.get("businessName") ?? "MATO"),
      placesApiKey: String(formData.get("placesApiKey") ?? ""),
      detectionCategories: JSON.stringify(categories),
      enabledZones: JSON.stringify(zones.length ? zones : [...FLANDERS_ZONES]),
      exclusionRadiusKm: Number(formData.get("exclusionRadiusKm") ?? 0.5),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  await audit(user.id, "settings.updated", "settings", "default");
}

export async function setLeadCompliance(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z.object({
    leadId: idSchema,
    complianceStatus: z.enum(["PENDING", "CLEARED", "BLOCKED"]),
    suppressionReason: z.string().trim().max(1000).optional(),
  }).parse(formObject(formData));
  const blocked = input.complianceStatus === "BLOCKED";
  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      complianceStatus: input.complianceStatus,
      doNotContact: blocked,
      suppressionReason: blocked ? input.suppressionReason || "Manual DNC" : null,
      suppressionCheckedAt: new Date(),
      ...(blocked ? { status: "DO_NOT_CONTACT", nextActionAt: null } : {}),
    },
  });
  await audit(user.id, "lead.compliance_changed", "lead", input.leadId, input);
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/calls");
}
