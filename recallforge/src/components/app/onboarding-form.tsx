"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";

const CONTEXTS = [
  ["university", "University course"],
  ["competitive_exam", "Competitive exam"],
  ["certification", "Professional certification"],
  ["research", "Research / PhD"],
  ["language", "Language learning"],
  ["other", "Other"],
] as const;

const GOALS = [
  ["memorize", "Memorize key concepts"],
  ["understand", "Understand complex material"],
  ["exam", "Prepare for an exam"],
  ["oral", "Prepare for an oral examination"],
  ["papers", "Learn research papers"],
  ["retention", "Long-term retention"],
] as const;

function Choice({ options, value, onChange, name }: { options: readonly (readonly [string, string])[]; value: string | null; onChange: (v: string) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-xl border px-4 py-3 text-left text-sm transition-colors", value === v ? "border-primary bg-primary-soft font-medium text-primary" : "border-border bg-surface hover:bg-surface-2")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function OnboardingForm({ firstName }: { firstName: string | null }) {
  const router = useRouter();
  const [context, setContext] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [examDate, setExamDate] = useState("");
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit() {
    if (!context || !goal) return;
    setBusy(true);
    try {
      const r = await api<{ redirect: string }>("/api/onboarding", {
        body: { studyContext: context, primaryGoal: goal, examDate: examDate || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      router.push(r.redirect);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save your answers.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{firstName ? `Welcome, ${firstName}.` : "Welcome."}</h1>
        <p className="mt-2 text-muted">Three quick questions so we can tune your review schedule. You can change these later in Settings.</p>
      </div>
      <section className="space-y-3">
        <h2 className="font-medium">What are you studying?</h2>
        <Choice name="What are you studying?" options={CONTEXTS} value={context} onChange={setContext} />
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">What is your primary goal?</h2>
        <Choice name="What is your primary goal?" options={GOALS} value={goal} onChange={setGoal} />
      </section>
      <section className="space-y-2">
        <Label htmlFor="exam-date">When is your exam? (optional)</Label>
        <Input id="exam-date" type="date" min={today} value={examDate} onChange={(e) => setExamDate(e.target.value)} className="max-w-xs" />
        <p className="text-xs text-muted">We use it to spread your reviews so everything is learned before the day.</p>
      </section>
      <div className="flex items-center gap-3">
        <Button size="lg" onClick={submit} disabled={!context || !goal} loading={busy}>
          Continue
        </Button>
        {(!context || !goal) && <span className="text-sm text-muted">Choose an answer for both questions.</span>}
      </div>
    </div>
  );
}
