"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, RotateCcw, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Kbd, Progress } from "@/components/ui/misc";
import { SourceButton } from "@/components/app/source-viewer";
import { CardText } from "@/components/app/card-text";
import { api, ApiError } from "@/lib/client";
import { cn, pct } from "@/lib/utils";

type Rating = 1 | 2 | 3 | 4;
type StudyCard = {
  id: string;
  deckId: string;
  deckName: string;
  question: string;
  answer: string;
  cardType: string;
  sourcePage: number | null;
  sourceHeading: string | null;
  sourceQuote: string | null;
  sourceSectionId: string | null;
  confidenceLabel: string | null;
  needsVerification: boolean;
  state: string;
  intervals: Record<Rating, number>;
};

const RATINGS: { r: Rating; label: string; hint: string; cls: string }[] = [
  { r: 1, label: "Again", hint: "I didn't know it.", cls: "border-danger/40 bg-danger-soft text-danger" },
  { r: 2, label: "Hard", hint: "I struggled.", cls: "border-warning/40 bg-warning-soft text-warning" },
  { r: 3, label: "Good", hint: "I remembered it.", cls: "border-primary/40 bg-primary-soft text-primary" },
  { r: 4, label: "Easy", hint: "I knew it instantly.", cls: "border-success/40 bg-success-soft text-success" },
];

function fmt(mins: number) {
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  const d = mins / 1440;
  return d < 30 ? `${Math.round(d)}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}y`;
}

type Summary = { reviewed: number; correct: number; seconds: number; improvement: { before: number; after: number; strongest: { topic: string; delta: number } | null } | null };

export function StudySession({ deckIds, mode, topic, title, backHref }: { deckIds?: string[]; mode: "study" | "review" | "weak" | "cram"; topic?: string | null; title: string; backHref: string }) {
  const [queue, setQueue] = useState<StudyCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [done, setDone] = useState({ reviewed: 0, correct: 0 });
  const shownAt = useRef(Date.now());
  const started = useRef(Date.now());
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const pending = useRef<Promise<unknown>[]>([]);

  const load = useCallback(
    async (m = mode) => {
      setQueue(null);
      setError(null);
      setSummary(null);
      setIndex(0);
      setRevealed(false);
      setDone({ reviewed: 0, correct: 0 });
      pending.current = [];
      try {
        const r = await api<{ cards: StudyCard[]; sessionId: string | null }>("/api/study/queue", { body: { deckIds, mode: m, topic } });
        setQueue(r.cards);
        setSessionId(r.sessionId);
        started.current = Date.now();
        shownAt.current = Date.now();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't load your cards.");
      }
    },
    [deckIds, mode, topic],
  );
  useEffect(() => {
    load();
  }, [load]);

  const card = queue?.[index];

  const finish = useCallback(async () => {
    await Promise.allSettled(pending.current);
    let improvement: Summary["improvement"] = null;
    if (sessionId) {
      const r = await api<{ improvement: Summary["improvement"] }>("/api/study/finish", { body: { sessionId } }).catch(() => null);
      improvement = r?.improvement ?? null;
    }
    setSummary({ ...done, seconds: Math.round((Date.now() - started.current) / 1000), improvement });
  }, [done, sessionId]);

  const rate = useCallback(
    (r: Rating) => {
      if (!card || !revealed || !queue) return;
      const durationMs = Date.now() - shownAt.current;
      const p = api<{ scheduledMins: number }>("/api/study/review", { body: { cardId: card.id, rating: r, sessionId, durationMs } })
        .then((res) => {
          // Cards due again within this session (e.g. "Again" → 10 min) come back at the end of the queue.
          if (res.scheduledMins <= 20) {
            setQueue((q) => (q ? [...q, { ...card, state: "LEARNING", intervals: card.intervals }] : q));
          }
        })
        .catch((e) => toast.error(e instanceof ApiError ? e.message : "A rating didn't save. Check your connection."));
      pending.current.push(p);
      setDone((d) => ({ reviewed: d.reviewed + 1, correct: d.correct + (r >= 3 ? 1 : 0) }));
      setRevealed(false);
      setDragX(0);
      shownAt.current = Date.now();
      setIndex((i) => i + 1);
    },
    [card, queue, revealed, sessionId],
  );

  const queueRef = useRef<StudyCard[] | null>(null);
  const finishing = useRef(false);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    if (!queue || summary || queue.length === 0 || index < queue.length || finishing.current) return;
    finishing.current = true;
    // Wait for in-flight ratings: a card due again within minutes is appended to the queue.
    Promise.allSettled(pending.current).then(() =>
      setTimeout(() => {
        finishing.current = false;
        if (queueRef.current && index >= queueRef.current.length) finish();
      }, 0),
    );
  }, [index, queue, summary, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.closest?.("[role=dialog]")) return;
      if (e.code === "Space" || e.key === "Enter") {
        if (!revealed && card) {
          e.preventDefault();
          setRevealed(true);
        }
      } else if (["1", "2", "3", "4"].includes(e.key) && revealed) {
        e.preventDefault();
        rate(Number(e.key) as Rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, revealed, rate]);

  if (error) {
    return (
      <Shell title={title} backHref={backHref}>
        <div className="text-center">
          <p className="text-danger">{error}</p>
          <Button className="mt-4" onClick={() => load()}>
            Try again
          </Button>
        </div>
      </Shell>
    );
  }
  if (!queue) {
    return (
      <Shell title={title} backHref={backHref}>
        <div className="flex flex-col items-center gap-3 text-muted" aria-busy="true">
          <Loader2 className="size-6 animate-spin" /> Loading your cards…
        </div>
      </Shell>
    );
  }
  if (summary) {
    const acc = summary.reviewed ? summary.correct / summary.reviewed : 0;
    return (
      <Shell title={title} backHref={backHref}>
        <div className="mx-auto max-w-md text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <h2 className="mt-3 font-serif text-2xl font-semibold">Session complete</h2>
          <dl className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <dd className="text-xl font-semibold">{summary.reviewed}</dd>
              <dt className="text-xs text-muted">reviews</dt>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dd className="text-xl font-semibold">{pct(acc)}</dd>
              <dt className="text-xs text-muted">remembered</dt>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dd className="text-xl font-semibold">{Math.max(1, Math.round(summary.seconds / 60))}m</dd>
              <dt className="text-xs text-muted">studied</dt>
            </div>
          </dl>
          {summary.improvement && (
            <div className="mt-6 rounded-xl border border-success/30 bg-success-soft p-4 text-left text-sm">
              <p className="flex items-center gap-2 font-medium">
                <TrendingUp className="size-4 text-success" /> You&apos;re getting stronger.
              </p>
              <p className="mt-1">
                Recall rate: {pct(summary.improvement.before)} last week → {pct(summary.improvement.after)} now.
                {summary.improvement.strongest && ` Strongest improvement: ${summary.improvement.strongest.topic} (+${Math.round(summary.improvement.strongest.delta * 100)}%).`}
              </p>
            </div>
          )}
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="secondary">
              <Link href={backHref}>Done</Link>
            </Button>
            <Button onClick={() => load()}>
              <RotateCcw /> Keep going
            </Button>
          </div>
        </div>
      </Shell>
    );
  }
  if (queue.length === 0) {
    return (
      <Shell title={title} backHref={backHref}>
        <div className="mx-auto max-w-md text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <h2 className="mt-3 font-serif text-2xl font-semibold">{mode === "weak" ? "No weak cards right now" : "You're all caught up"}</h2>
          <p className="mt-2 text-sm text-muted">{mode === "weak" ? "Nothing here is currently below 70% predicted recall or repeatedly forgotten." : "No cards are due and you've reached today's new-card limit."}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="secondary">
              <Link href={backHref}>Back</Link>
            </Button>
            <Button onClick={() => load("cram")}>Review all cards anyway</Button>
          </div>
          <p className="mt-3 text-xs text-muted">Extra reviews still count, but cards reviewed early grow their intervals less.</p>
        </div>
      </Shell>
    );
  }
  if (!card) {
    return (
      <Shell title={title} backHref={backHref}>
        <div className="flex flex-col items-center gap-3 text-muted">
          <Loader2 className="size-6 animate-spin" /> Saving…
        </div>
      </Shell>
    );
  }

  const isCloze = card.cardType === "cloze";
  return (
    <Shell title={title} backHref={backHref} progress={{ done: index, total: queue.length }}>
      <div className="mx-auto flex w-full max-w-2xl flex-col sm:pt-6">
        <div
          key={`${card.id}-${index}`}
          className="card-flip-enter flex min-h-[320px] flex-col rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-10"
          style={{ transform: dragX ? `translateX(${dragX}px) rotate(${dragX / 40}deg)` : undefined, transition: dragX ? "none" : "transform 150ms" }}
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchMove={(e) => {
            if (!touch.current || !revealed) return;
            const dx = e.touches[0].clientX - touch.current.x;
            if (Math.abs(dx) > Math.abs(e.touches[0].clientY - touch.current.y)) setDragX(dx);
          }}
          onTouchEnd={() => {
            // Optional swipe: left = Again, right = Good (buttons and keys always work too).
            if (revealed && Math.abs(dragX) > 110) rate(dragX < 0 ? 1 : 3);
            else setDragX(0);
            touch.current = null;
          }}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="truncate">{card.deckName}</span>
            {card.state === "NEW" && <Badge tone="primary">New</Badge>}
            {card.needsVerification && <Badge tone="warning">Unverified card</Badge>}
          </div>
          <p className="font-serif text-xl leading-relaxed sm:text-2xl" aria-live="polite">
            <CardText text={card.question} cloze={isCloze} reveal={isCloze && revealed} />
          </p>
          {revealed ? (
            <div className="mt-6 border-t border-border pt-6">
              {!isCloze && <p className="text-lg leading-relaxed">{card.answer}</p>}
              {isCloze && <p className="text-sm text-muted">Answer: {card.answer}</p>}
              {(card.sourcePage != null || card.sourceHeading) && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
                  <span>
                    Source{card.sourcePage != null ? ` · Page ${card.sourcePage}` : ""}
                    {card.sourceHeading ? ` · Section: ${card.sourceHeading}` : ""}
                  </span>
                  <SourceButton sectionId={card.sourceSectionId} quote={card.sourceQuote} page={card.sourcePage} heading={card.sourceHeading} />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-auto pt-10 text-center">
              <Button size="lg" onClick={() => setRevealed(true)} className="w-full sm:w-auto">
                Reveal answer
              </Button>
              <p className="mt-2 hidden text-xs text-muted sm:block">
                Press <Kbd>Space</Kbd>
              </p>
            </div>
          )}
        </div>

        {revealed && (
          <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember?">
            {RATINGS.map(({ r, label, hint, cls }) => (
              <button key={r} onClick={() => rate(r)} className={cn("flex flex-col items-center rounded-2xl border px-1 py-3 transition-transform active:scale-95", cls)} aria-label={`${label}: ${hint} Next review in ${fmt(card.intervals[r])}`}>
                <span className="text-sm font-semibold">{label}</span>
                <span className="hidden text-[11px] opacity-80 sm:block">{hint}</span>
                <span className="mt-1 text-[11px] tabular-nums opacity-80">{fmt(card.intervals[r])}</span>
                <span className="mt-1 hidden sm:block">
                  <Kbd>{r}</Kbd>
                </span>
              </button>
            ))}
          </div>
        )}
        {revealed && <p className="mt-2 text-center text-[11px] text-muted sm:hidden">Tip: swipe left for Again, right for Good.</p>}
      </div>
    </Shell>
  );
}

function Shell({ title, backHref, children, progress }: { title: string; backHref: string; children: React.ReactNode; progress?: { done: number; total: number } }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <Button asChild variant="ghost" size="icon" aria-label="End session">
          <Link href={backHref}>
            <X />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          {progress && (
            <div className="mt-1 flex items-center gap-2">
              <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="h-1.5" label="Session progress" />
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {progress.done}/{progress.total}
              </span>
            </div>
          )}
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col px-4 pb-8 pt-2 sm:px-6">
        {children}
      </main>
    </div>
  );
}
