"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PricingCards } from "./pricing-cards";
import { api, ApiError } from "@/lib/client";

export function PricingClient({ plan, stripeEnabled, devBilling, signedIn }: { plan?: "FREE" | "PRO"; stripeEnabled: boolean; devBilling: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!signedIn) return <PricingCards />;
  const choose = async (interval: "month" | "year") => {
    if (busy) return;
    setBusy(true);
    try {
      if (stripeEnabled) {
        const { url } = await api<{ url: string }>("/api/billing/checkout", { body: { interval } });
        window.location.href = url;
        return;
      }
      if (devBilling) {
        await api("/api/billing/dev", { body: { action: "upgrade", interval } });
        toast.success("You're on Pro (development billing — no payment taken).");
        router.push("/settings/billing?checkout=success");
        router.refresh();
        return;
      }
      toast.error("Payments aren't configured on this server yet.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't start checkout.");
    } finally {
      setBusy(false);
    }
  };
  return <PricingCards currentPlan={plan} onChoosePro={choose} />;
}
