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

/**
 * Alleen de beheerder mag zoeken: elke scan kost geld bij Google Places.
 * Medewerkers werken de gevonden lijst af, ze vullen hem niet aan.
 */
export async function scanZone(zone: string) {
  await requireUser(["admin"]);
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

/**
 * Zet deze zaak blijvend op jouw naam.
 *
 * Dit is wat commissie beschermt, en daarom is het geen zachte claim die na een
 * half uur vervalt: zolang de lead van jou is kan een collega hem niet
 * overnemen, ook niet als je er een week niet naar kijkt.
 *
 * De voorwaarde staat in de `where` van een `updateMany`, zodat twee mensen die
 * tegelijk op de knop drukken niet allebei kunnen slagen. Wie verliest krijgt
 * te zien wie er wél eigenaar is.
 */
export async function takeLead(leadId: string) {
  const user = await requireUser(["admin", "sales"]);
  const id = idSchema.parse(leadId);

  const { count } = await prisma.lead.updateMany({
    where: { id, OR: [{ ownerId: null }, { ownerId: user.id }] },
    data: { ownerId: user.id, ownedAt: new Date() },
  });

  if (count !== 1) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { owner: { select: { name: true } } },
    });
    throw new Error(
      lead?.owner
        ? `${lead.owner.name} werkt al aan deze lead`
        : "Deze lead is net door iemand anders opgepakt"
    );
  }

  await audit(user.id, "lead.taken", "lead", id);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/mijn-leads");
  revalidatePath("/");
}

/** Terug in de gedeelde pot. De eigenaar zelf of de beheerder mag dit. */
export async function releaseLead(leadId: string) {
  const user = await requireUser(["admin", "sales"]);
  const id = idSchema.parse(leadId);

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { ownerId: true, owner: { select: { name: true } } },
  });
  if (!lead) throw new Error("Lead niet gevonden");
  if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
    throw new Error(`Deze lead staat op naam van ${lead.owner?.name ?? "een collega"}`);
  }

  await prisma.lead.update({
    where: { id },
    data: { ownerId: null, ownedAt: null, claimedById: null, claimedAt: null },
  });

  await audit(user.id, "lead.released", "lead", id, { previousOwner: lead.ownerId });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/mijn-leads");
  revalidatePath("/");
}

/** De beheerder wijst een lead toe aan iemand anders. */
export async function reassignLead(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const input = z
    .object({ leadId: idSchema, userId: z.string().cuid().or(z.literal("")) })
    .parse(formObject(formData));

  const target = input.userId
    ? await prisma.user.findFirst({
        where: { id: input.userId, active: true },
        select: { id: true },
      })
    : null;
  if (input.userId && !target) throw new Error("Medewerker niet gevonden");

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      ownerId: target?.id ?? null,
      ownedAt: target ? new Date() : null,
      claimedById: null,
      claimedAt: null,
    },
  });

  await audit(admin.id, "lead.reassigned", "lead", input.leadId, {
    to: target?.id ?? null,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/mijn-leads");
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
      // Wie belt, krijgt de zaak op zijn naam. Bellen ís het werk claimen, en
      // een lead die je gebeld hebt zonder eigenaar zou een collega zo kunnen
      // overnemen inclusief de commissie.
      ownerId: lead.ownerId ?? user.id,
      ...(lead.ownerId ? {} : { ownedAt: new Date() }),
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

/**
 * Verkocht: de lead wordt klant en er komt een deal op naam van wie hem sloot.
 *
 * Hier ontstaat de structuur waar de rest op steunt. De klant hangt via
 * `Customer.leadId` aan de oorspronkelijke lead, zodat het spoor van eerste
 * vondst tot handtekening heel blijft; de deal draagt `ownerId` en `wonValue`,
 * en dat zijn precies de twee getallen waarmee commissie en ROI berekend worden.
 * Documenten hangen straks aan diezelfde klant en deal.
 */
export async function markLeadWon(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      leadId: idSchema,
      value: z.coerce.number().min(0).max(10_000_000),
      title: z.string().trim().max(200).optional(),
    })
    .parse(formObject(formData));

  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: { customer: true },
  });
  if (!lead) throw new Error("Lead niet gevonden");

  const now = new Date();

  // Opzettelijk hergebruikt in plaats van opnieuw aangemaakt: `Customer.leadId`
  // is uniek, dus een tweede verkoop aan dezelfde zaak zou anders stuklopen.
  const customer =
    lead.customer ??
    (await prisma.customer.create({
      data: {
        name: lead.name,
        address: lead.address,
        city: lead.city,
        province: lead.province,
        phone: lead.phone,
        email: lead.email,
        website: lead.website,
        leadId: lead.id,
      },
    }));

  const deal = await prisma.deal.create({
    data: {
      title: input.title?.trim() || `Verkoop ${lead.name}`,
      stage: "WON",
      leadId: lead.id,
      customerId: customer.id,
      ownerId: user.id,
      wonValue: input.value,
      wonAt: now,
      lastActivityAt: now,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: "WON",
      nextActionAt: null,
      lastTouchedAt: now,
      claimedById: null,
      claimedAt: null,
      ownerId: lead.ownerId ?? user.id,
    },
  });

  await audit(user.id, "lead.won", "lead", lead.id, {
    dealId: deal.id,
    value: input.value,
  });

  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/leads");
  revalidatePath("/calls");
  revalidatePath("/team");
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
