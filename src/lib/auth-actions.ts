"use server";

import "server-only";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { clearSession, createSession, type AppRole } from "./session";
import {
  checkLoginRate,
  clientIp,
  pruneLoginAttempts,
  recordLoginAttempt,
} from "./rate-limit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

/**
 * Een geldige bcrypt-hash van een willekeurige waarde.
 *
 * Bestaat het opgegeven adres niet, dan wordt hiertegen vergeleken. Zonder dat
 * slaat een onbekend adres het rekenwerk over en is het antwoord meetbaar
 * sneller dan bij een fout wachtwoord — genoeg om van buitenaf uit te vlooien
 * welke e-mailadressen een account hebben.
 */
const TIMING_EQUALISER_HASH =
  "$2b$12$zBjzk9f8PgtxoAmqoZVfTemBP/hiPPka2.0V9WSraceFmgjdOl8sO";

const ROLES = ["admin", "sales", "reviewer"];

export type LoginState = { error?: string };

export async function login(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Vul een geldig e-mailadres en wachtwoord in." };

  const { email, password } = parsed.data;
  const ip = await clientIp();

  const rate = await checkLoginRate(email, ip);
  if (!rate.allowed) {
    return {
      error: `Te veel mislukte pogingen. Probeer over ${rate.retryAfterMinutes} minuten opnieuw.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const usable = Boolean(user?.active && ROLES.includes(user.role));
  const valid = await compare(
    password,
    usable && user ? user.passwordHash : TIMING_EQUALISER_HASH
  );

  if (!usable || !valid || !user) {
    await recordLoginAttempt(email, ip, false);
    return { error: "Onjuist e-mailadres of wachtwoord." };
  }

  await recordLoginAttempt(email, ip, true);
  await pruneLoginAttempts();
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession({
    userId: user.id,
    role: user.role as AppRole,
    v: user.sessionVersion,
  });
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
