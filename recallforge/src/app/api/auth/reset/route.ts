import { z } from "zod/v4";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { withPublic, parseBody, ok, jsonError } from "@/lib/api";
import { consumeToken } from "@/lib/auth/tokens";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { createSession, destroyAllSessions } from "@/lib/auth/session";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";

const Body = z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(200) });

export const POST = withPublic(async (req) => {
  const h = await headers();
  await enforceRateLimit(`reset:${clientIp(h)}`, 10, 3600);
  const body = await parseBody(req, Body);
  const problem = passwordProblem(body.password);
  if (problem) return jsonError(problem, 422, "weak_password");
  const userId = await consumeToken(body.token, "PASSWORD_RESET");
  if (!userId) return jsonError("This reset link is invalid or has expired. Request a new one.", 400, "invalid_token");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(body.password), emailVerifiedAt: new Date() } });
  await destroyAllSessions(userId);
  await createSession(userId, h.get("user-agent"));
  return ok({ ok: true, redirect: "/dashboard" });
});
