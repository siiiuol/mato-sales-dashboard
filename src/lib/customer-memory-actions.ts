"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import {
  isFactKey,
  normaliseFactValue,
} from "./customer-memory";
import { formObject, idSchema } from "./validation";

export type FactActionState = {
  error?: string;
  ok?: boolean;
};

async function canTouchLead(
  leadId: string | null | undefined,
  user: { id: string; role: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!leadId) return { ok: true };
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, owner: { select: { name: true } } },
  });
  if (!lead) return { ok: false, error: "Zaak niet gevonden" };
  if (lead.ownerId && lead.ownerId !== user.id && user.role !== "admin") {
    return {
      ok: false,
      error: `Deze zaak staat op naam van ${lead.owner?.name ?? "een collega"}`,
    };
  }
  return { ok: true };
}

export async function confirmCustomerFact(
  _previous: FactActionState,
  formData: FormData
): Promise<FactActionState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const { factId } = z.object({ factId: idSchema }).parse(formObject(formData));

    const fact = await prisma.customerFact.findUnique({
      where: { id: factId },
      select: { id: true, leadId: true, customerId: true, status: true, key: true },
    });
    if (!fact) return { error: "Feit niet gevonden" };
    if (fact.status === "CONFIRMED") return { ok: true };

    const access = await canTouchLead(fact.leadId, user);
    if (!access.ok) return { error: access.error };

    let customerId = fact.customerId;
    if (!customerId && fact.leadId) {
      const customer = await prisma.customer.findUnique({
        where: { leadId: fact.leadId },
        select: { id: true },
      });
      customerId = customer?.id ?? null;
    }

    await prisma.customerFact.update({
      where: { id: fact.id },
      data: {
        status: "CONFIRMED",
        confirmedById: user.id,
        confirmedAt: new Date(),
        confidence: 1,
        ...(customerId ? { customerId } : {}),
      },
    });

    await audit(user.id, "fact.confirmed", "lead", fact.leadId ?? undefined, {
      factId: fact.id,
      key: fact.key,
    });

    if (fact.leadId) revalidatePath(`/leads/${fact.leadId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Bevestigen mislukt",
    };
  }
}

export async function rejectCustomerFact(
  _previous: FactActionState,
  formData: FormData
): Promise<FactActionState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const { factId } = z.object({ factId: idSchema }).parse(formObject(formData));

    const fact = await prisma.customerFact.findUnique({
      where: { id: factId },
      select: { id: true, leadId: true, status: true, key: true },
    });
    if (!fact) return { error: "Feit niet gevonden" };

    const access = await canTouchLead(fact.leadId, user);
    if (!access.ok) return { error: access.error };

    await prisma.customerFact.update({
      where: { id: fact.id },
      data: {
        status: "REJECTED",
        confirmedById: user.id,
        confirmedAt: new Date(),
      },
    });

    await audit(user.id, "fact.rejected", "lead", fact.leadId ?? undefined, {
      factId: fact.id,
      key: fact.key,
    });

    if (fact.leadId) revalidatePath(`/leads/${fact.leadId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Afwijzen mislukt",
    };
  }
}

export async function addCustomerFact(
  _previous: FactActionState,
  formData: FormData
): Promise<FactActionState> {
  try {
    const user = await requireUser(["admin", "sales"]);
    const parsed = z
      .object({
        leadId: idSchema,
        key: z.string(),
        value: z.string(),
      })
      .safeParse(formObject(formData));
    if (!parsed.success) {
      return { error: "Controleer sleutel en waarde" };
    }
    if (!isFactKey(parsed.data.key)) {
      return { error: "Onbekende feitsleutel" };
    }
    const value = normaliseFactValue(parsed.data.value);
    if (!value) return { error: "Vul een waarde in" };

    const access = await canTouchLead(parsed.data.leadId, user);
    if (!access.ok) return { error: access.error };

    const customer = await prisma.customer.findUnique({
      where: { leadId: parsed.data.leadId },
      select: { id: true },
    });

    const duplicate = await prisma.customerFact.findFirst({
      where: {
        leadId: parsed.data.leadId,
        key: parsed.data.key,
        value,
        status: { in: ["SUGGESTED", "CONFIRMED"] },
      },
      select: { id: true, status: true },
    });
    if (duplicate?.status === "CONFIRMED") {
      return { ok: true };
    }
    if (duplicate?.status === "SUGGESTED") {
      await prisma.customerFact.update({
        where: { id: duplicate.id },
        data: {
          status: "CONFIRMED",
          confirmedById: user.id,
          confirmedAt: new Date(),
          confidence: 1,
          source: "MANUAL",
          customerId: customer?.id ?? null,
        },
      });
    } else {
      await prisma.customerFact.create({
        data: {
          leadId: parsed.data.leadId,
          customerId: customer?.id ?? null,
          key: parsed.data.key,
          value,
          confidence: 1,
          status: "CONFIRMED",
          source: "MANUAL",
          confirmedById: user.id,
          confirmedAt: new Date(),
        },
      });
    }

    await audit(user.id, "fact.added", "lead", parsed.data.leadId, {
      key: parsed.data.key,
    });
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Opslaan mislukt",
    };
  }
}
