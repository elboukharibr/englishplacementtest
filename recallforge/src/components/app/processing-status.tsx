"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";

type Status = { status: string; stage: string | null; progress: number; errorReason: string | null };

const STAGES = [
  { key: "upload", label: "Uploading…", until: 5 },
  { key: "extract", label: "Extracting text…", until: 22 },
  { key: "structure", label: "Detecting document structure…", until: 32 },
  { key: "index", label: "Indexing passages for search…", until: 40 },
  { key: "concepts", label: "Analyzing concepts…", until: 88 },
  { key: "prepare", label: "Preparing study material…", until: 100 },
];

/** Polls processing status and shows each pipeline stage. Never an unexplained spinner. */
export function ProcessingStatus({ documentId, initial }: { documentId: string; initial: Status }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (s.status === "READY" || s.status === "FAILED") return;
    const started = Date.now();
    let stop = false;
    const tick = async () => {
      try {
        const next = await api<Status>(`/api/documents/${documentId}/status`);
        if (stop) return;
        setS(next);
        if (next.status === "READY" || next.status === "FAILED") {
          router.refresh();
          return;
        }
      } catch {
        /* transient: keep polling */
      }
      if (Date.now() - started > 4 * 60_000) setSlow(true);
      if (!stop) setTimeout(tick, 1500);
    };
    const t = setTimeout(tick, 800);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [documentId, router, s.status]);

  if (s.status === "FAILED") {
    return (
      <Alert
        tone="danger"
        title="We couldn't process this document."
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={retrying}
              onClick={async () => {
                setRetrying(true);
                try {
                  await api(`/api/documents/${documentId}/retry`, { body: {} });
                  setS({ status: "UPLOADED", stage: "Queued for another attempt", progress: 3, errorReason: null });
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : "Couldn't retry.");
                } finally {
                  setRetrying(false);
                }
              }}
            >
              Retry
            </Button>
          </div>
        }
      >
        {s.errorReason ?? "An unknown error occurred."}
      </Alert>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{s.stage ?? "Working…"}</span>
        <span className="tabular-nums text-muted">{s.progress}%</span>
      </div>
      <Progress value={s.progress} label="Processing progress" />
      <ol className="mt-6 space-y-2.5" aria-live="polite">
        {STAGES.map((st, i) => {
          const prevUntil = i === 0 ? 0 : STAGES[i - 1].until;
          const state = s.progress >= st.until ? "done" : s.progress >= prevUntil ? "active" : "todo";
          return (
            <li key={st.key} className={cn("flex items-center gap-3 text-sm", state === "todo" && "text-muted")}>
              {state === "done" ? <CheckCircle2 className="size-4 text-success" /> : state === "active" ? <Loader2 className="size-4 animate-spin text-primary" /> : <Circle className="size-4" />}
              {st.label}
            </li>
          );
        })}
      </ol>
      {s.status === "UPLOADED" && s.progress <= 3 && <p className="mt-5 text-xs text-muted">Waiting for a processing slot. This usually starts within a few seconds.</p>}
      {slow && (
        <p className="mt-5 flex items-center gap-2 text-xs text-warning">
          <XCircle className="size-3.5" /> This is taking longer than usual. Large documents can take several minutes; you can leave this page and come back.
        </p>
      )}
    </div>
  );
}
