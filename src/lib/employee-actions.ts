"use server";

import "server-only";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./db";
import { audit, requireUser } from "./dal";
import { generatePassword } from "./password";
import { storeImage, UploadError } from "./storage";
import { formObject, idSchema } from "./validation";

/**
 * Beheer van medewerkersaccounts. Alles hier is uitsluitend voor de beheerder —
 * `requireUser(["admin"])` staat in elke actie apart en niet één keer centraal,
 * omdat een server action rechtstreeks aanroepbaar is vanaf de client. De
 * verborgen navigatie is versiering; dit is het slot.
 */

const employeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "sales", "reviewer"]),
  monthlyCost: z.coerce.number().min(0).max(1_000_000).default(0),
  commissionType: z.enum(["PERCENT", "FIXED"]),
  commissionValue: z.coerce.number().min(0).max(1_000_000).default(0),
});

export type EmployeeFormState = {
  error?: string;
  /** Alleen bij aanmaken, en alleen deze ene keer te zien. */
  createdPassword?: string;
  createdName?: string;
};

export async function createEmployee(
  _previous: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const admin = await requireUser(["admin"]);

  const parsed = employeeSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { error: "Controleer de ingevulde gegevens." };
  }
  const input = parsed.data;

  if (input.commissionType === "PERCENT" && input.commissionValue > 100) {
    return { error: "Een commissie in procent kan niet boven 100 liggen." };
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return { error: "Er bestaat al een account met dit e-mailadres." };
  }

  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await storeImage(photo, "medewerker");
    } catch (err) {
      if (err instanceof UploadError) return { error: err.message };
      throw err;
    }
  }

  const password = generatePassword();
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hash(password, 12),
      monthlyCost: input.monthlyCost,
      commissionType: input.commissionType,
      commissionValue: input.commissionValue,
      photoUrl,
      startedAt: new Date(),
    },
  });

  // Het wachtwoord zelf blijft uit het logboek: dat is te lezen door iedereen
  // met toegang tot de database en zou het hele punt van hashen ondergraven.
  await audit(admin.id, "employee.created", "user", user.id, {
    email: user.email,
    role: user.role,
  });

  revalidatePath("/team");
  return { createdPassword: password, createdName: user.name };
}

export async function updateEmployee(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const id = idSchema.parse(formData.get("userId"));
  const input = employeeSchema.parse(formObject(formData));

  if (input.commissionType === "PERCENT" && input.commissionValue > 100) {
    throw new Error("Een commissie in procent kan niet boven 100 liggen.");
  }

  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new Error("Medewerker niet gevonden");

  // Een rolwijziging moet meteen gelden. Het lopende token draagt de oude rol,
  // dus zonder deze ophoging houdt iemand zijn oude rechten tot de sessie
  // vanzelf verloopt.
  const roleChanged = current.role !== input.role;

  let photoUrl = current.photoUrl;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    photoUrl = await storeImage(photo, "medewerker");
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      monthlyCost: input.monthlyCost,
      commissionType: input.commissionType,
      commissionValue: input.commissionValue,
      photoUrl,
      ...(roleChanged ? { sessionVersion: { increment: 1 } } : {}),
    },
  });

  await audit(admin.id, "employee.updated", "user", id, { roleChanged });
  revalidatePath("/team");
  revalidatePath(`/team/${id}`);
}

/**
 * Zet een medewerker aan of uit.
 *
 * Uitzetten hoogt `sessionVersion` op, waardoor het bestaande sessietoken op
 * slag ongeldig is. Alleen `active` op false zetten zou iemand tot twaalf uur
 * lang binnen laten met de cookie die hij al had — precies het moment waarop je
 * dat níet wil.
 */
export async function setEmployeeActive(formData: FormData) {
  const admin = await requireUser(["admin"]);
  const id = idSchema.parse(formData.get("userId"));
  const active = formData.get("active") === "true";

  if (id === admin.id && !active) {
    throw new Error("Je kunt je eigen account niet uitschakelen.");
  }

  await prisma.user.update({
    where: { id },
    data: { active, sessionVersion: { increment: 1 } },
  });

  await audit(admin.id, active ? "employee.enabled" : "employee.disabled", "user", id);
  revalidatePath("/team");
  revalidatePath(`/team/${id}`);
}

/** Geeft een nieuw wachtwoord dat één keer getoond wordt. */
export async function resetEmployeePassword(
  _previous: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const admin = await requireUser(["admin"]);
  const id = idSchema.parse(formData.get("userId"));

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "Medewerker niet gevonden" };

  const password = generatePassword();
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hash(password, 12),
      // Een nieuw wachtwoord hoort alle bestaande sessies te verdrijven; anders
      // blijft wie het oude wachtwoord had gewoon ingelogd.
      sessionVersion: { increment: 1 },
    },
  });

  await audit(admin.id, "employee.password_reset", "user", id);
  revalidatePath(`/team/${id}`);
  return { createdPassword: password, createdName: user.name };
}
