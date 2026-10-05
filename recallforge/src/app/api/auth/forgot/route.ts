import { z } from "zod/v4";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { withPublic, parseBody, ok } from "@/lib/api";
import { issueToken } from "@/lib/auth/tokens";
import { resetEmail, sendEmail } from "@/lib/email";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

export const POST = withPublic(async (req) => {
  const h = await headers();
  const body = await parseBody(req, Body);
  await enforceRateLimit(`forgot:${clientIp(h)}`, 5, 3600);
  await enforceRateLimit(`forgot:${body.email}`, 3, 3600);
  const user = await db.user.findUnique({ where: { email: body.email } });
  if (user) {
    const token = await issueToken(user.id, "PASSWORD_RESET");
    await sendEmail({ to: user.email, ...resetEmail(`${env.appUrl}/reset-password?token=${token}`) });
  }
  // Same response either way, so the endpoint can't be used to discover accounts.
  return ok({ ok: true });
});
