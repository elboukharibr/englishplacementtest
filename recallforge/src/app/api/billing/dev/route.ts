// DEVELOPMENT ONLY: simulates a Stripe subscription so the upgrade flow can be exercised
// locally without Stripe keys. Disabled unless ALLOW_DEV_BILLING=true and NODE_ENV !== production.
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";
import { env } from "@/lib/env";
import { recomputePlan } from "@/lib/billing/stripe";
import { track } from "@/lib/events";

const Body = z.object({ action: z.enum(["upgrade", "cancel"]), interval: z.enum(["month", "year"]).default("month") });

export const POST = withUser(async (req, user) => {
  if (!env.allowDevBilling) return jsonError("Not found.", 404);
  const b = await parseBody(req, Body);
  const id = `dev_sub_${user.id}`;
  if (b.action === "upgrade") {
    const start = new Date();
    const end = new Date(start);
    if (b.interval === "year") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    await db.subscription.upsert({
      where: { providerSubscriptionId: id },
      create: { userId: user.id, provider: "dev", providerSubscriptionId: id, status: "active", interval: b.interval, currentPeriodStart: start, currentPeriodEnd: end },
      update: { status: "active", interval: b.interval, currentPeriodStart: start, currentPeriodEnd: end, cancelAtPeriodEnd: false },
    });
    await track("subscription_started", user.id, { interval: b.interval, dev: true });
  } else {
    await db.subscription.updateMany({ where: { providerSubscriptionId: id }, data: { status: "canceled" } });
    await track("subscription_cancelled", user.id, { dev: true });
  }
  const plan = await recomputePlan(user.id);
  return ok({ plan });
});
