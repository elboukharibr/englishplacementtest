import { z } from "zod/v4";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { withPublic, parseBody, ok, jsonError } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

// Constant-time-ish behaviour for unknown emails (bcrypt hash of a random value).
const DUMMY_HASH = "$2b$12$gqaPmGvgNns0hcQtqKH1i.RSkEdNyLogw6YvweySlwWGSdY7nGa6q";

export const POST = withPublic(async (req) => {
  const h = await headers();
  const body = await parseBody(req, Body);
  await enforceRateLimit(`login:ip:${clientIp(h)}`, 30, 900);
  await enforceRateLimit(`login:email:${body.email}`, 10, 900);
  const user = await db.user.findUnique({ where: { email: body.email } });
  const valid = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !valid) {
    return jsonError(user && !user.passwordHash ? "This account uses Google sign-in. Continue with Google instead." : "Email or password is incorrect.", 401, "invalid_credentials");
  }
  await createSession(user.id, h.get("user-agent"));
  return ok({ ok: true, redirect: user.onboardedAt ? "/dashboard" : "/onboarding" });
});
