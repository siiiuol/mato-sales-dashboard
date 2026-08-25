"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { requireUser } from "./dal";
import { formObject, idSchema } from "./validation";
import { SHOP_DIKSMUIDE } from "./constants";

const optionalId = z.string().cuid().optional().or(z.literal(""));

const tenantSchema = z.object({
  leadId: optionalId,
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.union([z.literal(""), z.string().trim().email()]).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  productId: optionalId,
  model: z.string().trim().max(150).optional().or(z.literal("")),
  serialNumber: z.string().trim().max(100).optional().or(z.literal("")),
  contractType: z.enum(["FIXED", "COMMISSION", "MIX", "OTHER"]),
  contractRef: z.string().trim().max(120).optional().or(z.literal("")),
  contractStartedAt: z.string().optional().or(z.literal("")),
  contractEndsAt: z.string().optional().or(z.literal("")),
  noticePeriodDays: z.coerce.number().int().min(0).max(365).default(30),
  placementNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  shopSlot: z.string().optional().or(z.literal("")),
});

export type ShopTenantFormState = {
  error?: string;
};

async function getShopCapacity() {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
    select: { shopCapacity: true },
  });
  return Math.max(1, Math.min(40, settings.shopCapacity || 8));
}

async function assertShopSlotFree(slot: number | null, capacity: number) {
  if (slot === null) return;
  if (slot < 1 || slot > capacity) {
    throw new Error(`Plaats moet tussen 1 en ${capacity} liggen`);
  }
  const taken = await prisma.machinePlacement.findFirst({
    where: {
      site: SHOP_DIKSMUIDE.site,
      status: "ACTIVE",
      shopSlot: slot,
    },
    select: { id: true },
  });
  if (taken) throw new Error(`Plaats ${slot} is al bezet`);
}

/**
 * Nieuwe shop-huurder + actieve plaatsing in Diksmuide.
 */
export async function createShopTenant(
  _prev: ShopTenantFormState,
  formData: FormData
): Promise<ShopTenantFormState> {
  const user = await requireUser(["admin", "sales"]);
  const parsed = tenantSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Controleer de gegevens" };
  }
  const input = parsed.data;

  const startedAt = input.contractStartedAt
    ? new Date(input.contractStartedAt)
    : new Date();
  if (Number.isNaN(startedAt.getTime())) {
    return { error: "Ongeldige startdatum contract" };
  }
  const endsAt = input.contractEndsAt ? new Date(input.contractEndsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return { error: "Ongeldige einddatum contract" };
  }
  if (endsAt && endsAt <= startedAt) {
    return { error: "Einddatum moet na de startdatum liggen" };
  }

  const sourceLead = input.leadId
    ? await prisma.lead.findUnique({
        where: { id: input.leadId },
        select: {
          id: true,
          ownerId: true,
          customer: { select: { id: true } },
        },
      })
    : null;
  if (input.leadId && !sourceLead) return { error: "Lead niet gevonden" };
  if (sourceLead?.customer) {
    return { error: "Deze lead is al naar een klant omgezet" };
  }
  if (
    sourceLead?.ownerId &&
    sourceLead.ownerId !== user.id &&
    user.role !== "admin"
  ) {
    return { error: "Deze lead staat op naam van een collega" };
  }

  const capacity = await getShopCapacity();
  const slotRaw = input.shopSlot?.trim();
  const shopSlot = slotRaw ? Number(slotRaw) : null;
  if (slotRaw && (!Number.isInteger(shopSlot) || shopSlot === null)) {
    return { error: "Ongeldig plaatsnummer" };
  }

  try {
    await assertShopSlotFree(shopSlot, capacity);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Plaats bezet" };
  }

  const customer = await prisma.$transaction(async (tx) => {
    if (shopSlot !== null) {
      const clash = await tx.machinePlacement.findFirst({
        where: {
          site: SHOP_DIKSMUIDE.site,
          status: "ACTIVE",
          shopSlot,
        },
        select: { id: true },
      });
      if (clash) throw new Error(`Plaats ${shopSlot} is al bezet`);
    }

    const customer = await tx.customer.create({
      data: {
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        notes: input.notes || null,
        kind: "SHOP_TENANT",
        ownerId: sourceLead?.ownerId ?? user.id,
        leadId: sourceLead?.id ?? null,
        address: SHOP_DIKSMUIDE.address,
        city: SHOP_DIKSMUIDE.city,
        province: "West-Vlaanderen",
      },
    });

    const placement = await tx.machinePlacement.create({
      data: {
        customerId: customer.id,
        productId: input.productId || null,
        model: input.model || null,
        serialNumber: input.serialNumber || null,
        address: `${SHOP_DIKSMUIDE.address}, ${SHOP_DIKSMUIDE.postalCode}`,
        city: SHOP_DIKSMUIDE.city,
        site: SHOP_DIKSMUIDE.site,
        contractType: input.contractType,
        contractRef: input.contractRef || null,
        contractStartedAt: startedAt,
        contractEndsAt: endsAt,
        noticePeriodDays: input.noticePeriodDays,
        placedAt: startedAt,
        notes: input.placementNotes || null,
        shopSlot,
        status: "ACTIVE",
      },
    });

    if (endsAt) {
      const renewalDue = new Date(endsAt);
      renewalDue.setUTCDate(renewalDue.getUTCDate() - 60);
      await tx.task.create({
        data: {
          title: `Shopcontract ${customer.name}: verlenging bespreken`,
          customerId: customer.id,
          assignedToId: sourceLead?.ownerId ?? user.id,
          dueAt: renewalDue,
          cadenceKey: "SHOP_RENEWAL",
          cadenceStep: 1,
          status: "OPEN",
        },
      });
    }
    if (sourceLead) {
      await tx.lead.update({
        where: { id: sourceLead.id },
        data: {
          status: "WON",
          nextActionAt: null,
          lastTouchedAt: new Date(),
          claimedById: null,
          claimedAt: null,
          ownerId: sourceLead.ownerId ?? user.id,
        },
      });
      await tx.shopWaitlist.updateMany({
        where: {
          leadId: sourceLead.id,
          status: { in: ["WAITING", "CONTACTED"] },
        },
        data: {
          status: "CONVERTED",
          convertedCustomerId: customer.id,
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "shop.tenant_created",
        entityType: "customer",
        entityId: customer.id,
        detail: JSON.stringify({
          placementId: placement.id,
          contractType: input.contractType,
          shopSlot,
          leadId: sourceLead?.id ?? null,
          contractEndsAt: endsAt?.toISOString() ?? null,
        }),
      },
    });

    return customer;
  });

  revalidatePath("/shop");
  redirect(`/shop/${customer.id}`);
}

export async function updateShopPlacement(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      placementId: idSchema,
      customerId: idSchema,
      contractType: z.enum(["FIXED", "COMMISSION", "MIX", "OTHER"]),
      contractRef: z.string().trim().max(120).optional().or(z.literal("")),
      contractStartedAt: z.string().optional().or(z.literal("")),
      contractEndsAt: z.string().optional().or(z.literal("")),
      noticePeriodDays: z.coerce.number().int().min(0).max(365).default(30),
      renewalStatus: z.enum(["ACTIVE", "NOTICE_SENT", "RENEWING", "ENDING"]),
      model: z.string().trim().max(150).optional().or(z.literal("")),
      serialNumber: z.string().trim().max(100).optional().or(z.literal("")),
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
      shopSlot: z.string().optional().or(z.literal("")),
    })
    .parse(formObject(formData));

  const startedAt = input.contractStartedAt
    ? new Date(input.contractStartedAt)
    : undefined;
  if (startedAt && Number.isNaN(startedAt.getTime())) {
    throw new Error("Ongeldige startdatum");
  }
  const endsAt = input.contractEndsAt
    ? new Date(input.contractEndsAt)
    : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    throw new Error("Ongeldige einddatum");
  }
  if (startedAt && endsAt && endsAt <= startedAt) {
    throw new Error("Einddatum moet na de startdatum liggen");
  }

  const capacity = await getShopCapacity();
  const slotRaw = input.shopSlot?.trim() ?? "";
  const shopSlot = slotRaw === "" ? null : Number(slotRaw);
  if (slotRaw !== "" && !Number.isInteger(shopSlot)) {
    throw new Error("Ongeldig plaatsnummer");
  }
  if (shopSlot !== null) {
    if (shopSlot < 1 || shopSlot > capacity) {
      throw new Error(`Plaats moet tussen 1 en ${capacity} liggen`);
    }
    const clash = await prisma.machinePlacement.findFirst({
      where: {
        site: SHOP_DIKSMUIDE.site,
        status: "ACTIVE",
        shopSlot,
        NOT: { id: input.placementId },
      },
      select: { id: true },
    });
    if (clash) throw new Error(`Plaats ${shopSlot} is al bezet`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.machinePlacement.update({
      where: { id: input.placementId },
      data: {
        contractType: input.contractType,
        contractRef: input.contractRef || null,
        contractStartedAt: startedAt,
        contractEndsAt: endsAt,
        noticePeriodDays: input.noticePeriodDays,
        renewalStatus: input.renewalStatus,
        model: input.model || null,
        serialNumber: input.serialNumber || null,
        notes: input.notes || null,
        shopSlot,
      },
    });

    const renewalTask = await tx.task.findFirst({
      where: {
        customerId: input.customerId,
        cadenceKey: "SHOP_RENEWAL",
        status: "OPEN",
      },
      select: { id: true },
    });
    if (endsAt && input.renewalStatus !== "ENDING") {
      const renewalDue = new Date(endsAt);
      renewalDue.setUTCDate(renewalDue.getUTCDate() - 60);
      if (renewalTask) {
        await tx.task.update({
          where: { id: renewalTask.id },
          data: { dueAt: renewalDue },
        });
      } else {
        await tx.task.create({
          data: {
            title: "Shopcontract: verlenging bespreken",
            customerId: input.customerId,
            assignedToId: user.id,
            dueAt: renewalDue,
            cadenceKey: "SHOP_RENEWAL",
            cadenceStep: 1,
            status: "OPEN",
          },
        });
      }
    } else if (renewalTask) {
      await tx.task.update({
        where: { id: renewalTask.id },
        data: { status: "CANCELLED" },
      });
    }

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "shop.placement_updated",
        entityType: "machine",
        entityId: input.placementId,
        detail: JSON.stringify({
          customerId: input.customerId,
          shopSlot,
          contractEndsAt: endsAt?.toISOString() ?? null,
          renewalStatus: input.renewalStatus,
        }),
      },
    });
  });
  revalidatePath(`/shop/${input.customerId}`);
  revalidatePath("/shop");
}

/** Beheerder past het aantal fysieke plaatsen in de shop aan. */
export async function setShopCapacity(formData: FormData) {
  await requireUser(["admin"]);
  const raw = String(formData.get("shopCapacity") ?? "");
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 40) {
    throw new Error("Capaciteit moet tussen 1 en 40 liggen");
  }
  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: { shopCapacity: n },
    create: { id: "default", shopCapacity: n },
  });
  revalidatePath("/shop");
  revalidatePath("/settings");
}

export async function createShopWaitlistEntry(
  _previous: ShopTenantFormState,
  formData: FormData
): Promise<ShopTenantFormState> {
  const user = await requireUser(["admin", "sales"]);
  const parsed = z
    .object({
      leadId: optionalId,
      name: z.string().trim().min(1).max(200),
      phone: z.string().trim().max(40).optional().or(z.literal("")),
      email: z.union([z.literal(""), z.string().trim().email()]).optional(),
      notes: z.string().trim().max(2000).optional().or(z.literal("")),
      preferredSlot: z.coerce.number().int().min(1).max(40).optional(),
    })
    .safeParse(formObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Controleer de gegevens" };
  }
  const input = parsed.data;
  const existing = await prisma.shopWaitlist.findFirst({
    where: {
      status: "WAITING",
      OR: [
        ...(input.leadId ? [{ leadId: input.leadId }] : []),
        ...(input.email ? [{ email: input.email }] : []),
        { name: input.name },
      ],
    },
    select: { id: true },
  });
  if (existing) return { error: "Deze zaak staat al op de wachtlijst" };

  await prisma.$transaction(async (tx) => {
    const entry = await tx.shopWaitlist.create({
      data: {
        leadId: input.leadId || null,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        notes: input.notes || null,
        preferredSlot: input.preferredSlot ?? null,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "shop.waitlist_added",
        entityType: "shop_waitlist",
        entityId: entry.id,
      },
    });
  });
  revalidatePath("/shop");
  redirect("/shop");
}

export async function updateShopWaitlistStatus(formData: FormData) {
  const user = await requireUser(["admin", "sales"]);
  const input = z
    .object({
      entryId: idSchema,
      status: z.enum(["WAITING", "CONTACTED", "CONVERTED", "CANCELLED"]),
    })
    .parse(formObject(formData));
  await prisma.$transaction([
    prisma.shopWaitlist.update({
      where: { id: input.entryId },
      data: { status: input.status },
    }),
    prisma.auditEvent.create({
      data: {
        actorId: user.id,
        action: "shop.waitlist_updated",
        entityType: "shop_waitlist",
        entityId: input.entryId,
        detail: JSON.stringify({ status: input.status }),
      },
    }),
  ]);
  revalidatePath("/shop");
}
