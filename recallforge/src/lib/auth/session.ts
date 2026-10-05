// Session management: opaque random token in an httpOnly cookie, SHA-256 hash in the DB.
// A stolen database therefore does not yield usable session tokens.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "rf_session";
const SESSION_DAYS = 30;
const RENEW_WITHIN_DAYS = 15;

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({
    data: { id: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 250) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function validateSessionToken(token: string): Promise<User | null> {
  const id = sha256(token);
  const session = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  if (session.expiresAt.getTime() - Date.now() < RENEW_WITHIN_DAYS * 86400000) {
    await db.session
      .update({ where: { id }, data: { expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000) } })
      .catch(() => {});
  }
  return session.user;
}

/** Current user for this request (memoized per request). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

/** For server components/pages: redirect to login when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages inside the app shell: also enforce onboarding. */
export async function requireOnboardedUser(): Promise<User> {
  const user = await requireUser();
  if (!user.onboardedAt) redirect("/onboarding");
  return user;
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export function isAdmin(user: Pick<User, "role" | "email">): boolean {
  return user.role === "ADMIN" || env.adminEmails.includes(user.email.toLowerCase());
}
