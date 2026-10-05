"use client";
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { PLAN_LIMITS, PRICING } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const free = PLAN_LIMITS.FREE;
const pro = PLAN_LIMITS.PRO;

export function PricingCards({ onChoosePro, currentPlan }: { onChoosePro?: (interval: "month" | "year") => void; currentPlan?: "FREE" | "PRO" }) {
  const [annual, setAnnual] = useState(true);
  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-3" role="radiogroup" aria-label="Billing period">
        {(["Monthly", "Annual"] as const).map((label) => {
          const active = (label === "Annual") === annual;
          return (
            <button
              key={label}
              role="radio"
              aria-checked={active}
              onClick={() => setAnnual(label === "Annual")}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium", active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2")}
            >
              {label}
              {label === "Annual" && <span className="ml-1.5 text-xs opacity-80">save ${PRICING.yearly.savings}</span>}
            </button>
          );
        })}
      </div>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-3xl border border-border bg-surface p-7">
          <h3 className="text-lg font-semibold">Free</h3>
          <p className="mt-1 text-sm text-muted">Try the full study loop on real material.</p>
          <p className="mt-6">
            <span className="text-4xl font-semibold">$0</span>
            <span className="text-muted">/month</span>
          </p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {[
              `${free.documentsPerPeriod} document uploads per month`,
              `Up to ${free.pagesPerDocument} pages per document`,
              `${free.cardsPerPeriod} AI cards per month`,
              "Basic, definition and cloze cards",
              "Study mode with spaced repetition",
              "CSV, Quizlet and text export",
            ].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
              </li>
            ))}
          </ul>
          <Button asChild variant="secondary" className="mt-8">
            <Link href={currentPlan ? "/dashboard" : "/signup"}>{currentPlan === "FREE" ? "Your current plan" : currentPlan ? "Go to dashboard" : "Start free"}</Link>
          </Button>
        </div>
        <div className="relative flex flex-col rounded-3xl border-2 border-primary bg-surface p-7 shadow-[var(--shadow)]">
          <Badge tone="primary" className="absolute -top-3 left-7">
            Most popular
          </Badge>
          <h3 className="text-lg font-semibold">Pro</h3>
          <p className="mt-1 text-sm text-muted">For heavy reading loads and exam season.</p>
          <p className="mt-6">
            <span className="text-4xl font-semibold">${annual ? PRICING.yearly.monthlyEquivalent : PRICING.monthly.amount}</span>
            <span className="text-muted">/month</span>
          </p>
          <p className="text-sm text-muted">{annual ? `$${PRICING.yearly.amount} billed yearly — save $${PRICING.yearly.savings}/year` : "Billed monthly, cancel anytime"}</p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {[
              `${pro.documentsPerPeriod} documents and ${pro.cardsPerPeriod.toLocaleString()} AI cards per month (fair use)`,
              `Long PDFs — up to ${pro.pagesPerDocument} pages each`,
              "All card styles: comparisons, applications, scenarios, critical thinking",
              "Exam mode and oral exam mode",
              "AI tutor grounded in your documents",
              "Knowledge maps, analytics and study plans",
              "Anki (.apkg) export",
              "Priority processing",
            ].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
              </li>
            ))}
          </ul>
          {currentPlan === "PRO" ? (
            <Button asChild className="mt-8">
              <Link href="/settings/billing">Manage your plan</Link>
            </Button>
          ) : onChoosePro ? (
            <Button className="mt-8" onClick={() => onChoosePro(annual ? "year" : "month")}>
              Start Pro
            </Button>
          ) : (
            <Button asChild className="mt-8">
              <Link href={`/signup?plan=pro&interval=${annual ? "year" : "month"}`}>Start Pro</Link>
            </Button>
          )}
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted">
        Pro limits exist because every generated card costs real AI compute. They reset each billing period and are sized well above typical heavy use.
      </p>
    </div>
  );
}
