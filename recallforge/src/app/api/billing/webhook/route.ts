import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { handleStripeEvent, stripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!env.stripeWebhookSecret || !env.stripeSecret) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const r = await handleStripeEvent(event);
    return NextResponse.json({ received: true, duplicate: r.duplicate });
  } catch (e) {
    console.error("[stripe webhook] handler failed", event.type, e);
    // 500 → Stripe retries the event later.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
