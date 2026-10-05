import type { AuthTokenType } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "./crypto";

const TTL_MS: Record<AuthTokenType, number> = {
  EMAIL_VERIFY: 48 * 3600_000,
  PASSWORD_RESET: 60 * 60_000,
};

export async function issueToken(userId: string, type: AuthTokenType): Promise<string> {
  // Invalidate older tokens of the same type.
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  const token = randomToken();
  await db.authToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS[type]) },
  });
  return token;
}

/** Consumes a token. Returns the userId if valid. */
export async function consumeToken(token: string, type: AuthTokenType): Promise<string | null> {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  await db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}
