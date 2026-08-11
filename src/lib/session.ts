import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "mato_session";
const SESSION_SECONDS = 60 * 60 * 12;

export type AppRole = "admin" | "sales" | "reviewer";
export type SessionPayload = {
  userId: string;
  role: AppRole;
  /**
   * Snapshot van `User.sessionVersion` op het moment van aanmelden.
   *
   * `getCurrentUser` vergelijkt dit met de databasewaarde, dus het ophogen van
   * dat veld verwerpt elk bestaand token. Zonder dit blijft een gedeactiveerde
   * medewerker tot twaalf uur lang binnen met de cookie die hij al had.
   */
  v: number;
};

function key() {
  const secret =
    process.env.SESSION_SECRET ??
    (process.env.NODE_ENV !== "production"
      ? "mato-local-development-session-secret-change-me"
      : undefined);
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(key());
}

export async function verifySessionToken(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (
      typeof payload.userId !== "string" ||
      typeof payload.v !== "number" ||
      !["admin", "sales", "reviewer"].includes(String(payload.role))
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      role: payload.role as AppRole,
      v: payload.v,
    };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
    path: "/",
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
