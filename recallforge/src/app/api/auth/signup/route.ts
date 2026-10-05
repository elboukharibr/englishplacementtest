import { z } from "zod/v4";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { withPublic, parseBody, ok, jsonError } from "@/lib/api";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { createSession, isAdmin } from "@/lib/auth/session";
import { issueToken } from "@/lib/auth/tokens";
import { sendEmail, verificationEmail } from "@/lib/email";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { track } from "@/lib/events";

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z.string().min(1).max(200),
});

export const POST = withPublic(async (req) => {
  const h = await headers();
  await enforceRateLimit(`signup:${clientIp(h)}`, 10, 3600);
  const body = await parseBody(req, Body);
  const problem = passwordProblem(body.password);
  if (problem) return jsonError(problem, 422, "weak_password", { field: "password" });
  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) return jsonError("An account with this email already exists. Try signing in.", 409, "email_taken", { field: "email" });
  const user = await db.user.create({
    data: { email: body.email, name: body.name, passwordHash: await hashPassword(body.password) },
  });
  if (isAdmin(user)) await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  await sendEmail({ to: user.email, ...verificationEmail(`${env.appUrl}/api/auth/verify?token=${token}`) });
  await createSession(user.id, h.get("user-agent"));
  await track("signup_completed", user.id, { method: "password" });
  return ok({ ok: true, redirect: "/onboarding" });
});
