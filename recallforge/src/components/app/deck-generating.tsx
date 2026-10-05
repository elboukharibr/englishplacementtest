"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, Progress } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client";

type S = { status: string; progress: number; statusMessage: string | null };

export function DeckGenerating({ deckId, initial }: { deckId: string; initial: S }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (s.status !== "GENERATING") return;
    let stop = false;
    const tick = async () => {
      try {
        const next = await api<S>(`/api/decks/${deckId}/status`);
        if (stop) return;
        setS(next);
        if (next.status !== "GENERATING") return router.refresh();
      } catch {
        /* keep polling */
      }
      if (!stop) setTimeout(tick, 1500);
    };
    const t = setTimeout(tick, 1000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [deckId, router, s.status]);

  if (s.status === "FAILED") {
    return (
      <Alert
        tone="danger"
        title="We couldn't generate this deck."
        action={
          <Button
            size="sm"
            loading={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                await api(`/api/decks/${deckId}/retry`, { body: {} });
                setS({ status: "GENERATING", progress: 2, statusMessage: "Queued…" });
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : "Couldn't retry.");
              } finally {
                setRetrying(false);
              }
            }}
          >
            Retry
          </Button>
        }
      >
        {s.statusMessage ?? "Unknown error."}
      </Alert>
    );
  }
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-primary" />
      <p className="mt-4 font-serif text-xl font-semibold">Building your deck</p>
      <p className="mt-1 text-sm text-muted" aria-live="polite">
        {s.statusMessage ?? "Working…"}
      </p>
      <Progress value={s.progress} className="mt-6" label="Generation progress" />
      <p className="mt-4 text-xs text-muted">Each card is checked against its source passage before it&apos;s saved. You can leave this page — we&apos;ll notify you when it&apos;s ready.</p>
    </div>
  );
}
