"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { runDetection } from "./detection";
import { FLANDERS_ZONES } from "./constants";
import { z } from "zod";
import { audit, requireUser } from "./dal";
import { claimableWhere } from "./claims";
import { callOutcomeSchema, formObject, idSchema } from "./validation";
import { logCallForLead } from "./call-log";
import { readSettingSecret, storeSettingSecret } from "./settings-secrets";
import { definedOnly, nextPlainValue, nextSecretValue } from "./settings-fields";
import { cancelCadence, enrollCustomerOnboarding } from "./cadence-actions";

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
  const result = await runDetection(prisma, zone, {
    ...settings,
    placesApiKey: readSettingSecret(settings.placesApiKey),
  });
  revalidatePath("/");
  revalidatePath("/leads");
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

  await logCallForLead({
    leadId: parsed.leadId,
    outcome: parsed.outcome,
    note: parsed.note,
    callbackAt: parsed.callbackAt,
    userId: user.id,
  });

  revalidatePath("/leads");
  revalidatePath("/mijn-leads");
  revalidatePath("/");
  redirect(`/leads/${parsed.leadId}`);
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
  await cancelCadence({ leadId: id }, "LEAD_FOLLOWUP").catch((err) =>
    console.error("kon opvolgreeks niet annuleren", err)
  );
  revalidatePath("/leads");
  revalidatePath("/");
  revalidatePath("/taken");
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

  const { customer, deal } = await prisma.$transaction(async (tx) => {
    // Opzettelijk hergebruikt in plaats van opnieuw aangemaakt:
    // `Customer.leadId` is uniek, dus een tweede verkoop aan dezelfde zaak zou
    // anders stuklopen.
    const customer =
      lead.customer ??
      (await tx.customer.create({
        data: {
          name: lead.name,
          address: lead.address,
          city: lead.city,
          province: lead.province,
          phone: lead.phone,
          email: lead.email,
          website: lead.website,
          leadId: lead.id,
          kind: "BUYER",
          ownerId: user.id,
        },
      }));

    const deal = await tx.deal.create({
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

    await tx.lead.update({
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

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "lead.won",
        entityType: "lead",
        entityId: lead.id,
        detail: JSON.stringify({ dealId: deal.id, value: input.value }),
      },
    });

    return { customer, deal };
  });

  // De lead-opvolging is voorbij — dit ís de conversie waar ze op wachtte.
  // De klant start zijn eigen, andersoortige ritme: nazorg, geen overtuiging.
  await Promise.all([
    cancelCadence({ leadId: lead.id }, "LEAD_FOLLOWUP"),
    enrollCustomerOnboarding(customer.id, deal.ownerId ?? user.id),
  ]).catch((err) => console.error("kon opvolgcadans niet bijwerken bij winst", err));

  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/leads");
  revalidatePath("/team");
  revalidatePath("/");
  revalidatePath("/klanten");
  revalidatePath("/taken");
}

export async function saveSettings(formData: FormData) {
  const user = await requireUser(["admin"]);

  /** `null` als het veld niet op dit formulier stond — dan blijft het ongemoeid. */
  const field = (name: string) =>
    formData.has(name) ? String(formData.get(name) ?? "") : null;
  const secret = (name: string) =>
    nextSecretValue({
      submitted: field(name),
      clear: formData.get(`${name}_clear`) === "on",
    });

  const categories = formData.has("categories")
    ? String(formData.get("categories") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const zones = formData.has("zones_present")
    ? formData.getAll("zones").map(String)
    : null;
  const radius = field("exclusionRadiusKm");

  const changes = definedOnly({
    businessName: nextPlainValue(field("businessName")) || undefined,
    // Geheimen: leeg laten betekent laten staan. Zie settings-fields.ts.
    placesApiKey: storeSettingSecret(secret("placesApiKey")),
    anthropicApiKey: storeSettingSecret(secret("anthropicApiKey")),
    anthropicModel: nextPlainValue(field("anthropicModel")) || undefined,
    msClientId: nextPlainValue(field("msClientId")),
    msTenantId: nextPlainValue(field("msTenantId")),
    // Het enige geheim dat versleuteld de database in gaat; de twee id's
    // hierboven zijn openbaar en staan sowieso in elke autorisatie-URL.
    msClientSecret: storeSettingSecret(secret("msClientSecret")),
    detectionCategories: categories ? JSON.stringify(categories) : undefined,
    // Alles uitvinken betekent "nergens zoeken", niet "overal zoeken". Het
    // omgekeerde schrijven zou de keuze van de beheerder vervangen door haar
    // tegendeel, en dat op een knop die geld kost per scan.
    enabledZones: zones ? JSON.stringify(zones) : undefined,
    exclusionRadiusKm:
      radius !== null && radius !== "" ? Number(radius) : undefined,
    pitchTemplates: nextPlainValue(field("pitchTemplates")),
    shopCapacity: (() => {
      const raw = field("shopCapacity");
      if (raw === null || raw === "") return undefined;
      const n = Number(raw);
      return Number.isInteger(n) && n >= 1 && n <= 40 ? n : undefined;
    })(),
  });

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: changes,
    create: { id: "default", ...changes },
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
}
