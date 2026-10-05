// Stripe integration. Subscription state is written ONLY by server code from data fetched
// from Stripe (webhooks, or a server-side sync after Checkout) — never from the browser.
import Stripe from "stripe";
import type { Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { UserFacingError } from "@/lib/errors";
import { track } from "@/lib/events";
import { notify } from "@/lib/notifications";
import { statusGrantsPro } from "./plans";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!env.stripeSecret) throw new UserFacingError("Billing isn't configured on this server yet.", 503, "billing_unconfigured");
  if (!client) client = new Stripe(env.stripeSecret, { maxNetworkRetries: 2 });
  return client;
}

export async function ensureCustomer(user: { id: string; email: string; name: string | null; stripeCustomerId: string | null }) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create({ email: user.email, name: user.name ?? undefined, metadata: { userId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(user: { id: string; email: string; name: string | null; stripeCustomerId: string | null }, interval: "month" | "year") {
  const price = interval === "year" ? env.stripePriceYearly : env.stripePriceMonthly;
  if (!price) throw new UserFacingError("Billing isn't configured on this server yet.", 503, "billing_unconfigured");
  const customer = await ensureCustomer(user);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { userId: user.id } },
    success_url: `${env.appUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/pricing?checkout=cancelled`,
  });
  return session.url!;
}

export async function createPortalSession(user: { id: string; email: string; name: string | null; stripeCustomerId: string | null }) {
  const customer = await ensureCustomer(user);
  const portal = await stripe().billingPortal.sessions.create({ customer, return_url: `${env.appUrl}/settings/billing` });
  return portal.url;
}

function periodOf(sub: Stripe.Subscription): { start: Date | null; end: Date | null } {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
  const legacy = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const s = item?.current_period_start ?? legacy.current_period_start;
  const e = item?.current_period_end ?? legacy.current_period_end;
  return { start: s ? new Date(s * 1000) : null, end: e ? new Date(e * 1000) : null };
}

/** Upserts our Subscription row from a Stripe subscription object and recomputes the user's plan. */
export async function syncSubscription(sub: Stripe.Subscription, userIdHint?: string | null) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user =
    (userIdHint ? await db.user.findUnique({ where: { id: userIdHint } }) : null) ??
    (sub.metadata?.userId ? await db.user.findUnique({ where: { id: sub.metadata.userId } }) : null) ??
    (await db.user.findUnique({ where: { stripeCustomerId: customerId } }));
  if (!user) {
    console.warn("[stripe] subscription for unknown customer", customerId);
    return null;
  }
  const { start, end } = periodOf(sub);
  const price = sub.items?.data?.[0]?.price;
  const before = user.plan;
  await db.subscription.upsert({
    where: { providerSubscriptionId: sub.id },
    create: {
      userId: user.id,
      providerSubscriptionId: sub.id,
      priceId: price?.id,
      interval: price?.recurring?.interval ?? null,
      status: sub.status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      priceId: price?.id,
      interval: price?.recurring?.interval ?? null,
      status: sub.status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
  const plan = await recomputePlan(user.id, customerId);
  if (before === "FREE" && plan === "PRO") await track("subscription_started", user.id, { interval: price?.recurring?.interval ?? null });
  if (before === "PRO" && plan === "FREE") await track("subscription_cancelled", user.id, {});
  return plan;
}

export async function recomputePlan(userId: string, stripeCustomerId?: string): Promise<Plan> {
  const subs = await db.subscription.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  const active = subs.find((s) => statusGrantsPro(s.status));
  const plan: Plan = active ? "PRO" : "FREE";
  await db.user.update({
    where: { id: userId },
    data: { plan, subscriptionStatus: active?.status ?? subs[0]?.status ?? null, ...(stripeCustomerId ? { stripeCustomerId } : {}) },
  });
  return plan;
}

/** Called on the Checkout success redirect so Pro shows immediately, even before the webhook lands. */
export async function syncCheckoutSession(sessionId: string, userId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== userId) throw new UserFacingError("This checkout session belongs to another account.", 403);
  if (session.subscription && typeof session.subscription !== "string") return syncSubscription(session.subscription, userId);
  return null;
}

function subscriptionIdFromInvoice(inv: Stripe.Invoice): string | null {
  const anyInv = inv as unknown as { subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } } } };
  const s = anyInv.parent?.subscription_details?.subscription ?? anyInv.subscription;
  if (!s) return null;
  return typeof s === "string" ? s : s.id;
}

/** Idempotent webhook processing (each Stripe event id is handled once). */
export async function handleStripeEvent(event: Stripe.Event) {
  const already = await db.billingEvent.findUnique({ where: { id: event.id } });
  if (already) return { duplicate: true };

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.mode === "subscription" && s.subscription) {
        const sub = await stripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
        await syncSubscription(sub, s.client_reference_id);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object);
      break;
    case "invoice.payment_failed": {
      const inv = event.data.object;
      const subId = subscriptionIdFromInvoice(inv);
      if (subId) {
        const sub = await stripe().subscriptions.retrieve(subId);
        await syncSubscription(sub);
        const row = await db.subscription.findUnique({ where: { providerSubscriptionId: subId } });
        if (row) {
          await notify(row.userId, {
            kind: "system",
            title: "Your payment didn't go through",
            body: "Stripe will retry automatically. Update your card in Billing to keep Pro.",
            href: "/settings/billing",
            dedupeKey: `payfail-${inv.id}`,
          });
        }
      }
      break;
    }
    case "invoice.paid": {
      const subId = subscriptionIdFromInvoice(event.data.object);
      if (subId) await syncSubscription(await stripe().subscriptions.retrieve(subId));
      break;
    }
    default:
      break;
  }
  await db.billingEvent.create({ data: { id: event.id, type: event.type } }).catch(() => {});
  return { duplicate: false };
}

export async function listInvoices(customerId: string) {
  const res = await stripe().invoices.list({ customer: customerId, limit: 24 });
  return res.data.map((i) => ({
    id: i.id,
    number: i.number,
    created: new Date(i.created * 1000),
    amount: (i.amount_paid || i.amount_due) / 100,
    currency: i.currency.toUpperCase(),
    status: i.status,
    url: i.hosted_invoice_url,
    pdf: i.invoice_pdf,
  }));
}
