import { z } from "zod/v4";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { features } from "@/lib/env";
import { track } from "@/lib/events";
import { enforceRateLimit } from "@/lib/rate-limit";

const Body = z.object({ interval: z.enum(["month", "year"]) });

export const POST = withUser(async (req, user) => {
  const { interval } = await parseBody(req, Body);
  if (user.plan === "PRO") return jsonError("You're already on Pro. Manage your plan from Billing.", 409, "already_pro");
  if (!features.stripe()) return jsonError("Payments aren't configured on this server yet (missing Stripe keys).", 503, "billing_unconfigured");
  await enforceRateLimit(`checkout:${user.id}`, 10, 600);
  const url = await createCheckoutSession(user, interval);
  await track("checkout_started", user.id, { interval });
  return ok({ url });
});
