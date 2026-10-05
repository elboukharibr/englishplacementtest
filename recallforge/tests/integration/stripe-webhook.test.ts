import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../helpers";

const SECRET = "whsec_test_secret";

function subscriptionEvent(id: string, type: string, sub: Partial<Stripe.Subscription> & Record<string, unknown>) {
  return { id, object: "event", type, api_version: "2026-09-30", created: Math.floor(Date.now() / 1000), data: { object: sub }, livemode: false, pending_webhooks: 0, request: null };
}

describe("Stripe webhook → subscription state", () => {
  let POST: (req: NextRequest) => Promise<Response>;
  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    ({ POST } = await import("@/app/api/billing/webhook/route"));
  });
  beforeEach(resetDb);

  async function send(event: object, signature?: string) {
    const payload = JSON.stringify(event);
    const header = signature ?? new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret: SECRET });
    return POST(new NextRequest("http://localhost/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
  }

  it("upgrades on subscription.created, is idempotent, and downgrades on deletion", async () => {
    const user = await createUser();
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: "cus_123" } });
    const now = Math.floor(Date.now() / 1000);
    const sub = {
      id: "sub_123",
      object: "subscription",
      customer: "cus_123",
      status: "active",
      cancel_at_period_end: false,
      metadata: { userId: user.id },
      items: { object: "list", data: [{ id: "si_1", current_period_start: now, current_period_end: now + 30 * 86400, price: { id: "price_m", recurring: { interval: "month" } } }] },
    };
    const r1 = await send(subscriptionEvent("evt_1", "customer.subscription.created", sub as never));
    expect(r1.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
    const row = await db.subscription.findUniqueOrThrow({ where: { providerSubscriptionId: "sub_123" } });
    expect(row.interval).toBe("month");
    expect(row.currentPeriodEnd!.getTime()).toBe((now + 30 * 86400) * 1000);

    const dup = await send(subscriptionEvent("evt_1", "customer.subscription.created", sub as never));
    expect(await dup.json()).toMatchObject({ duplicate: true });

    await send(subscriptionEvent("evt_2", "customer.subscription.deleted", { ...sub, status: "canceled" } as never));
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.plan).toBe("FREE");
    expect(after.subscriptionStatus).toBe("canceled");
  });

  it("rejects events with a bad signature", async () => {
    const res = await send(subscriptionEvent("evt_x", "customer.subscription.created", {} as never), "t=1,v1=deadbeef");
    expect(res.status).toBe(400);
  });
});
