import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type AppRole,
} from "./session";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: { id: session.userId, active: true },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user || user.role !== session.role) return null;
  return { ...user, role: user.role as AppRole };
});

export async function requireUser(roles?: readonly AppRole[]) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Aanmelden vereist", 401);
  if (roles && !roles.includes(user.role)) {
    throw new AuthError("Onvoldoende rechten", 403);
  }
  return user;
}

export async function requirePageUser(roles?: readonly AppRole[]) {
  try {
    return await requireUser(roles);
  } catch {
    redirect("/login");
  }
}

export function apiError(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Er ging iets mis" }, { status: 500 });
}

export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string,
  detail?: unknown
) {
  await prisma.auditEvent.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      detail: detail === undefined ? undefined : JSON.stringify(detail),
    },
  });
}
