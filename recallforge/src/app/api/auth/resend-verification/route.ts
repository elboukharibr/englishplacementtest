import { withUser, ok } from "@/lib/api";
import { issueToken } from "@/lib/auth/tokens";
import { sendEmail, verificationEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const POST = withUser(async (_req, user) => {
  if (user.emailVerifiedAt) return ok({ ok: true, alreadyVerified: true });
  await enforceRateLimit(`verify-resend:${user.id}`, 3, 3600);
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  const { delivered } = await sendEmail({ to: user.email, ...verificationEmail(`${env.appUrl}/api/auth/verify?token=${token}`) });
  return ok({ ok: true, delivered });
});
