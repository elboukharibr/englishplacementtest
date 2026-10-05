"use client";
import { useEffect, useState } from "react";
import { BrainCircuit, CalendarClock, FileText, Layers, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: FileText, label: "PDF" },
  { icon: BrainCircuit, label: "AI analysis" },
  { icon: Layers, label: "Flashcards" },
  { icon: CalendarClock, label: "Spaced repetition" },
  { icon: Trophy, label: "Mastery" },
];

/** Illustrative animation of the product pipeline. Content shown is an example, not user data. */
export function TransformDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow)]" aria-label="Illustration: a chapter becomes a study deck">
      <ol className="mb-5 flex items-center justify-between gap-1">
        {STEPS.map((s, i) => (
          <li key={s.label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-label={s.label}
              aria-current={i === step}
              className={cn("rounded-xl p-2 transition-colors", i === step ? "bg-primary text-primary-fg" : i < step ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted")}
            >
              <s.icon className="size-4" />
            </button>
            <span className={cn("hidden text-[11px] sm:block", i === step ? "text-fg" : "text-muted")}>{s.label}</span>
          </li>
        ))}
      </ol>
      <div className="h-[260px] overflow-hidden rounded-2xl bg-surface-2 p-4" aria-live="polite">
        <div key={step} className="card-flip-enter h-full">
          {step === 0 && (
            <div className="mx-auto h-full max-w-[230px] rounded-lg bg-surface p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-muted">Chapter 4 · p. 24</p>
              <p className="mt-1 font-serif text-sm font-semibold">Algorithmic visibility</p>
              {[100, 92, 96, 70, 98, 88, 94, 60].map((w, i) => (
                <div key={i} className={cn("mt-2 h-1.5 rounded bg-border", i === 3 && "bg-amber-300/70")} style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="grid h-full grid-cols-2 content-center gap-2 text-sm">
              {[
                ["Core concepts", "31"],
                ["Definitions", "14"],
                ["Key scholars", "9"],
                ["Relationships", "12"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface p-3">
                  <div className="text-2xl font-semibold tabular-nums">{v}</div>
                  <div className="text-xs text-muted">{k}</div>
                </div>
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="flex h-full flex-col justify-center gap-3">
              <div className="rounded-xl bg-surface p-4">
                <p className="text-xs text-muted">Question</p>
                <p className="font-serif">How does platformization redistribute media power?</p>
              </div>
              <div className="rounded-xl bg-surface p-4">
                <p className="text-xs text-muted">Answer · Source p. 24 · High confidence</p>
                <p className="text-sm">It shifts visibility and distribution toward platform-controlled infrastructures and algorithms.</p>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="flex h-full flex-col justify-center gap-2 text-sm">
              {[
                ["Again", "10 min", "bg-danger-soft text-danger"],
                ["Hard", "1 day", "bg-warning-soft text-warning"],
                ["Good", "3 days", "bg-primary-soft text-primary"],
                ["Easy", "7 days", "bg-success-soft text-success"],
              ].map(([k, v, c]) => (
                <div key={k} className="flex items-center justify-between rounded-xl bg-surface px-4 py-2.5">
                  <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", c)}>{k}</span>
                  <span className="text-muted">next review in {v}</span>
                </div>
              ))}
              <p className="pt-1 text-center text-xs text-muted">Intervals adapt to each card as you review.</p>
            </div>
          )}
          {step === 4 && (
            <div className="flex h-full items-center justify-center gap-6">
              <svg viewBox="0 0 36 36" className="size-32 -rotate-90">
                <circle cx="18" cy="18" r="15.5" className="fill-none stroke-border" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" className="fill-none stroke-success" strokeWidth="3" strokeDasharray="97.4" strokeDashoffset="21" strokeLinecap="round" />
              </svg>
              <div>
                <div className="text-3xl font-semibold">78%</div>
                <div className="text-sm text-muted">deck mastery</div>
                <div className="mt-2 text-xs text-success">Platform governance +31%</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">Illustrative example</p>
    </div>
  );
}
