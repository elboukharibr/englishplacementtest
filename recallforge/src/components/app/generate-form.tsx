"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/toggle";
import { Input, Label, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";

const FOCUS = [
  ["core", "Core concepts"],
  ["definitions", "Definitions"],
  ["theories", "Theories"],
  ["scholars", "Scholars and contributions"],
  ["examples", "Examples"],
  ["cause_effect", "Cause-effect relationships"],
  ["comparisons", "Comparisons"],
  ["processes", "Processes"],
  ["critical", "Critical thinking questions"],
  ["exam", "Exam questions"],
  ["dates", "Dates/facts"],
] as const;

const SIZES = [
  [20, "Essential"],
  [40, "Focused"],
  [80, "Comprehensive"],
  [120, "Intensive"],
] as const;

const STYLES = [
  ["definition", "Definition", false],
  ["basic", "Question → Answer", false],
  ["cloze", "Cloze deletion", false],
  ["comparison", "Compare/Contrast", true],
  ["cause_effect", "Cause → Effect", true],
  ["scholar", "Scholar → Contribution", true],
  ["application", "Application question", true],
  ["scenario", "Scenario question", true],
  ["critical", "Higher-order question", true],
  ["exam", "Exam-style question", true],
] as const;

export function GenerateForm(props: { documentId: string; defaultName: string; recommended: number; defaultSize: number; defaultDifficulty: string; maxCards: number; remainingCards: number; plan: "FREE" | "PRO"; studyGoalDefault: string }) {
  const router = useRouter();
  const isPro = props.plan === "PRO";
  const [focus, setFocus] = useState<string[]>(["core", "definitions", "theories", "scholars", "cause_effect", "comparisons", "processes", "critical", "exam"]);
  const [count, setCount] = useState(Math.min(props.defaultSize, props.maxCards));
  const [custom, setCustom] = useState(false);
  const [difficulty, setDifficulty] = useState(props.defaultDifficulty);
  const [goal, setGoal] = useState(props.studyGoalDefault);
  const [styles, setStyles] = useState<string[]>(isPro ? ["definition", "basic", "cloze", "comparison", "cause_effect", "scholar", "application", "critical"] : ["definition", "basic", "cloze"]);
  const [name, setName] = useState(props.defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string; count: number; capped: boolean }>("/api/decks", {
        body: { documentId: props.documentId, name, count, difficulty, studyGoal: goal, cardTypes: styles, focus },
      });
      if (r.capped) toast.info(`Generating ${r.count} cards — that's what's left in your monthly allowance.`);
      router.push(`/decks/${r.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.details?.issues) setError((e.details.issues as { message: string }[]).map((i) => i.message).join(" "));
      else if (e instanceof ApiError && e.status !== 402) setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 font-medium">What should I generate?</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FOCUS.map(([id, label]) => (
            <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm hover:bg-surface-2">
              <Checkbox checked={focus.includes(id)} onCheckedChange={() => toggle(focus, setFocus, id)} aria-label={label} />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 font-medium">Number of cards</h3>
          <div role="radiogroup" aria-label="Number of cards" className="grid grid-cols-3 gap-2">
            {SIZES.map(([n, label]) => {
              const disabled = n > props.maxCards;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={!custom && count === n}
                  disabled={disabled}
                  onClick={() => {
                    setCustom(false);
                    setCount(n);
                  }}
                  className={cn("rounded-xl border px-2 py-2 text-center text-sm disabled:opacity-40", !custom && count === n ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:bg-surface-2")}
                  title={disabled ? "Available on Pro" : undefined}
                >
                  <span className="block font-medium">{label}</span>
                  <span className="text-xs text-muted">{disabled ? `${n} · Pro` : n}</span>
                </button>
              );
            })}
            <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)} className={cn("rounded-xl border px-2 py-2 text-sm", custom ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:bg-surface-2")}>
              <span className="block font-medium">Custom</span>
              <span className="text-xs text-muted">5–{props.maxCards}</span>
            </button>
          </div>
          {custom && (
            <div className="mt-3 flex items-center gap-2">
              <Label htmlFor="custom-count" className="sr-only">
                Custom number of cards
              </Label>
              <Input id="custom-count" type="number" min={5} max={props.maxCards} value={count} onChange={(e) => setCount(Math.max(5, Math.min(props.maxCards, Number(e.target.value) || 5)))} className="w-28" />
              <span className="text-sm text-muted">cards</span>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">
            Recommended for this document: about {props.recommended}. {props.remainingCards} AI cards left this period.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="basic">Basic</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal">Study goal</Label>
            <Select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="quick_revision">Quick revision</option>
              <option value="exam_preparation">Exam preparation</option>
              <option value="deep_understanding">Deep understanding</option>
              <option value="long_term_mastery">Long-term mastery</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="deck-name">Deck name</Label>
            <Input id="deck-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-medium">Card style</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STYLES.map(([id, label, pro]) => {
            const locked = pro && !isPro;
            return (
              <label key={id} className={cn("flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm", locked ? "opacity-60" : "cursor-pointer hover:bg-surface-2")}>
                <Checkbox checked={styles.includes(id)} disabled={locked} onCheckedChange={() => toggle(styles, setStyles, id)} aria-label={label} />
                <span className="flex-1">{label}</span>
                {locked && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Lock className="size-3" /> Pro
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={submit} loading={busy} disabled={!focus.length || !styles.length || !name.trim() || props.remainingCards <= 0}>
          Generate study deck
        </Button>
        {props.remainingCards <= 0 && <span className="text-sm text-danger">You&apos;ve used this period&apos;s AI card allowance.</span>}
      </div>
    </div>
  );
}
