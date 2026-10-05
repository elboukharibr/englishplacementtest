import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env, features } from "@/lib/env";
import { getUsage } from "@/lib/billing/usage";
import { limitsFor } from "@/lib/billing/plans";
import { listInvoices, syncCheckoutSession } from "@/lib/billing/stripe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, Badge, PageHeader, Progress } from "@/components/ui/misc";
import { BillingActions } from "@/components/app/billing-actions";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing & usage" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; session_id?: string }> }) {
  let user = await requireOnboardedUser();
  const sp = await searchParams;
  let syncError: string | null = null;
  // Verify the checkout server-side with Stripe so Pro shows immediately (webhooks may lag).
  if (sp.session_id && features.stripe()) {
    try {
      await syncCheckoutSession(sp.session_id, user.id);
      user = (await db.user.findUnique({ where: { id: user.id } }))!;
    } catch (e) {
      syncError = e instanceof Error ? e.message : "Couldn't confirm the payment yet.";
    }
  }
  const [usage, sub, invoices] = await Promise.all([
    getUsage(user.id),
    db.subscription.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
    features.stripe() && user.stripeCustomerId ? listInvoices(user.stripeCustomerId).catch(() => null) : Promise.resolve(null),
  ]);
  const limits = limitsFor(user.plan);
  const meters = [
    { label: "AI cards", used: usage.cardsGenerated, limit: limits.cardsPerPeriod },
    { label: "Documents", used: usage.documents, limit: limits.documentsPerPeriod },
    { label: "Pages processed", used: usage.pages, limit: limits.pagesPerPeriod },
    { label: "AI assistant requests", used: usage.aiRequests, limit: limits.aiRequestsPerPeriod },
  ];
  const processingPct = Math.round((usage.pages / limits.pagesPerPeriod) * 100);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & usage" />
      {sp.checkout === "success" && user.plan === "PRO" && <Alert tone="success" title="Welcome to Pro">Your subscription is active. Thanks for supporting the product.</Alert>}
      {sp.checkout === "success" && user.plan !== "PRO" && <Alert tone="info" title="Payment received — confirming">{syncError ?? "Stripe is confirming your subscription. Refresh in a few seconds."}</Alert>}
      {user.subscriptionStatus === "past_due" && <Alert tone="danger" title="Your last payment failed">Stripe will retry automatically. Update your payment method to keep Pro.</Alert>}
      {!features.stripe() && <Alert tone="warning" title="Stripe isn't configured on this server">Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the two price ids (see README → Stripe setup).{env.allowDevBilling && " Development billing is enabled so you can test the upgrade flow."}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan <Badge tone={user.plan === "PRO" ? "primary" : "neutral"}>{user.plan === "PRO" ? "Pro" : "Free"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sub && user.plan === "PRO" && (
            <p className="text-sm text-muted">
              {sub.interval === "year" ? "$120/year" : "$15/month"} · status {sub.status}
              {sub.currentPeriodEnd && ` · ${sub.cancelAtPeriodEnd ? "ends" : "renews"} ${sub.currentPeriodEnd.toLocaleDateString()}`}
              {sub.provider === "dev" && " · development billing"}
            </p>
          )}
          <BillingActions plan={user.plan} stripeEnabled={features.stripe()} devBilling={env.allowDevBilling} hasCustomer={Boolean(user.stripeCustomerId)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage this period</CardTitle>
          <p className="text-sm text-muted">
            {usage.periodStart.toLocaleDateString()} – {usage.periodEnd.toLocaleDateString()} · resets automatically
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {meters.map((m) => {
            const p = (m.used / m.limit) * 100;
            return (
              <div key={m.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="tabular-nums text-muted">
                    {m.used.toLocaleString()} / {m.limit.toLocaleString()}
                  </span>
                </div>
                <Progress value={p} tone={p >= 100 ? "danger" : p > 80 ? "warning" : "primary"} label={`${m.label} usage`} />
              </div>
            );
          })}
          <p className="text-sm text-muted">Processing quota: {processingPct}% used · Max {limits.pagesPerDocument} pages per document · {limits.maxUploadMb} MB per file</p>
          <p className="text-sm">
            Estimated time saved this period: <strong>{formatDuration(usage.minutesSaved)}</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing history</CardTitle>
        </CardHeader>
        <CardContent>
          {!invoices || invoices.length === 0 ? (
            <p className="text-sm text-muted">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-normal">Date</th>
                  <th className="font-normal">Amount</th>
                  <th className="font-normal">Status</th>
                  <th className="font-normal">
                    <span className="sr-only">Invoice</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2">{i.created.toLocaleDateString()}</td>
                    <td>
                      {i.amount.toFixed(2)} {i.currency}
                    </td>
                    <td>{i.status}</td>
                    <td className="text-right">
                      {i.url && (
                        <a href={i.url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
