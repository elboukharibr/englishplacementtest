"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client";

export function BillingActions({ plan, stripeEnabled, devBilling, hasCustomer }: { plan: "FREE" | "PRO"; stripeEnabled: boolean; devBilling: boolean; hasCustomer: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {plan === "FREE" && stripeEnabled && (
        <>
          <Button loading={busy === "m"} onClick={() => go("m", async () => void (window.location.href = (await api<{ url: string }>("/api/billing/checkout", { body: { interval: "month" } })).url))}>
            Upgrade — $15/month
          </Button>
          <Button variant="secondary" loading={busy === "y"} onClick={() => go("y", async () => void (window.location.href = (await api<{ url: string }>("/api/billing/checkout", { body: { interval: "year" } })).url))}>
            $120/year (save $60)
          </Button>
        </>
      )}
      {stripeEnabled && hasCustomer && (
        <Button variant="secondary" loading={busy === "p"} onClick={() => go("p", async () => void (window.location.href = (await api<{ url: string }>("/api/billing/portal", { body: {} })).url))}>
          Manage subscription & payment method
        </Button>
      )}
      {!stripeEnabled && devBilling && (
        <Button
          variant={plan === "FREE" ? "primary" : "secondary"}
          loading={busy === "dev"}
          onClick={() =>
            go("dev", async () => {
              await api("/api/billing/dev", { body: { action: plan === "FREE" ? "upgrade" : "cancel" } });
              toast.success(plan === "FREE" ? "Pro activated (development billing)." : "Subscription cancelled (development billing).");
              router.refresh();
            })
          }
        >
          {plan === "FREE" ? "Upgrade to Pro (dev — no payment)" : "Cancel Pro (dev)"}
        </Button>
      )}
    </div>
  );
}
