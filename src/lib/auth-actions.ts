"use server";

import "server-only";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "./db";
import { clearSession, createSession, type AppRole } from "./session";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export type LoginState = { error?: string };

export async function login(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user?.active
    ? await compare(parsed.data.password, user.passwordHash)
    : false;
  if (!user || !valid || !["admin", "sales", "reviewer"].includes(user.role)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { error: "Invalid credentials." };
  }

  await createSession({ userId: user.id, role: user.role as AppRole });
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
