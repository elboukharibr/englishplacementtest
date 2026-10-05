"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QUOTA_EVENT } from "@/lib/client";
import { formatDuration } from "@/lib/utils";

type Detail = { message?: string; minutesSaved?: number; plan?: string; quota?: string; feature?: string };

/** Shown whenever an API call reports a plan limit. One clear CTA, an easy way out, no tricks. */
export function UpsellDialog() {
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => {
    const onQuota = (e: Event) => setDetail((e as CustomEvent<Detail>).detail);
    window.addEventListener(QUOTA_EVENT, onQuota);
    return () => window.removeEventListener(QUOTA_EVENT, onQuota);
  }, []);
  const isPro = detail?.plan === "PRO";
  return (
    <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
      <DialogContent title={detail?.message ?? "You've reached a plan limit."}>
        <div className="space-y-4 text-sm">
          {detail?.minutesSaved ? (
            <p className="rounded-xl bg-success-soft p-3 text-fg">
              You've already saved approximately <strong>{formatDuration(detail.minutesSaved)}</strong> of manual flashcard creation this month
              <span className="text-muted"> (estimate)</span>.
            </p>
          ) : null}
          {isPro ? (
            <p className="text-muted">Pro includes generous fair-use limits that reset with your billing period. If you need more, contact support and we'll look at your use case.</p>
          ) : (
            <p className="text-muted">Upgrade to Pro to keep converting your study materials, with long-PDF support, exam mode, the AI tutor and Anki export.</p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Maybe later
            </Button>
            {!isPro && (
              <Button asChild>
                <Link href="/pricing" onClick={() => setDetail(null)}>
                  <Sparkles /> Upgrade to Pro
                </Link>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
