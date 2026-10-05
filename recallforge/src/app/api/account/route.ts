import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody } from "@/lib/api";
import { storage } from "@/lib/storage";
import { destroyCurrentSession } from "@/lib/auth/session";
import { stripe } from "@/lib/billing/stripe";
import { features } from "@/lib/env";

const Body = z.object({ confirm: z.literal("DELETE") });

/** Permanently deletes the account: files in storage, all rows (cascade), and cancels Stripe subscriptions. */
export const DELETE = withUser(async (req, user) => {
  await parseBody(req, Body);
  const docs = await db.document.findMany({ where: { userId: user.id }, select: { storageKey: true } });
  for (const d of docs) if (d.storageKey) await storage().delete(d.storageKey).catch(() => {});
  if (features.stripe()) {
    const subs = await db.subscription.findMany({ where: { userId: user.id, status: { in: ["active", "trialing", "past_due"] } } });
    for (const s of subs) await stripe().subscriptions.cancel(s.providerSubscriptionId).catch((e) => console.error("[account] cancel failed", e));
  }
  await destroyCurrentSession();
  await db.user.delete({ where: { id: user.id } });
  return ok({ ok: true, redirect: "/" });
});
