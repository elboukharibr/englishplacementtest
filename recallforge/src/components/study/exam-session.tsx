"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mic, MicOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Progress, Alert } from "@/components/ui/misc";
import { Textarea, Label, Select } from "@/components/ui/form";
import { SourceButton } from "@/components/app/source-viewer";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";

type Attempt = { id: string; question: string; questionType: string; mode: string };
type Result = {
  attempt: { id: string; question: string; modelAnswer: string; userAnswer: string; total: number; scores: Record<string, number>; feedback: { covered: string[]; missing: string[]; inaccuracies: string[]; suggestions: string[]; summary: string }; followUp: string | null; keyPoints: string[] };
  sources: { id: string; heading: string | null; pageStart: number | null }[];
};

const TYPE_LABEL: Record<string, string> = { short_answer: "Short answer", explanation: "Concept explanation", compare_contrast: "Compare & contrast", analytical: "Analytical", scenario: "Scenario", follow_up: "Follow-up" };
const SCORE_LABEL: Record<string, string> = { accuracy: "Knowledge accuracy", completeness: "Conceptual completeness", terminology: "Terminology", reasoning: "Reasoning" };

type SpeechRec = { start(): void; stop(): void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

function getRecognition(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const C = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  return C ? new C() : null;
}

export function ExamSession({ deckId, deckName, oral }: { deckId: string; deckName: string; oral: boolean }) {
  const [phase, setPhase] = useState<"setup" | "loading" | "answering" | "grading" | "result" | "done">("setup");
  const [count, setCount] = useState(oral ? 3 : 5);
  const [types, setTypes] = useState<string[]>(["short_answer", "explanation", "compare_contrast", "analytical", "scenario"]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const baseText = useRef("");

  useEffect(() => setSpeechSupported(Boolean(getRecognition())), []);

  async function start() {
    setPhase("loading");
    try {
      const r = await api<{ attempts: Attempt[] }>(`/api/exam/${deckId}`, { body: { count, types, oral } });
      setAttempts(r.attempts);
      setI(0);
      setScores([]);
      setPhase("answering");
    } catch (e) {
      setPhase("setup");
      if (!(e instanceof ApiError && e.status === 402)) toast.error(e instanceof ApiError ? e.message : "Couldn't create questions.");
    }
  }

  function toggleMic() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = getRecognition();
    if (!r) return;
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    baseText.current = answer ? answer + " " : "";
    r.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let k = 0; k < e.results.length; k++) {
        const res = e.results[k];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setAnswer((baseText.current + finalText + interim).trimStart());
    };
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") toast.error("Microphone access was blocked. You can type your answer instead.");
    };
    rec.current = r;
    r.start();
    setListening(true);
  }

  async function submit() {
    rec.current?.stop();
    const current = attempts[i];
    setPhase("grading");
    try {
      const r = await api<Result>(`/api/exam/attempt/${current.id}/answer`, { body: { answer } });
      setResult(r);
      setScores((s) => [...s, r.attempt.total]);
      setPhase("result");
    } catch (e) {
      setPhase("answering");
      if (!(e instanceof ApiError && e.status === 402)) toast.error(e instanceof ApiError ? e.message : "Grading failed. Your answer is still here — try again.");
    }
  }

  async function next(followUp = false) {
    setAnswer("");
    if (followUp && result?.attempt.followUp) {
      try {
        const r = await api<{ attempt: Attempt }>(`/api/exam/attempt/${result.attempt.id}/followup`, { body: {} });
        setAttempts((a) => [...a.slice(0, i + 1), r.attempt, ...a.slice(i + 1)]);
        setI(i + 1);
        setResult(null);
        setPhase("answering");
        return;
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Couldn't load the follow-up.");
      }
    }
    setResult(null);
    if (i + 1 >= attempts.length) setPhase("done");
    else {
      setI(i + 1);
      setPhase("answering");
    }
  }

  if (phase === "setup" || phase === "loading") {
    return (
      <div className="mx-auto max-w-xl space-y-6 rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div>
          <h2 className="font-serif text-2xl font-semibold">{oral ? "Oral examination" : "Written exam"}</h2>
          <p className="mt-1 text-sm text-muted">
            {oral
              ? "Questions appear one at a time. Speak or type your answer; the examiner then grades it and asks a follow-up."
              : "Answer in your own words. You'll see the model answer and a breakdown only after you submit."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-count">Number of questions</Label>
          <Select id="ex-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {(oral ? [1, 2, 3] : [3, 5, 8, 10]).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        {!oral && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Question types</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_LABEL)
                .filter(([k]) => k !== "follow_up")
                .map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={types.includes(k)}
                    onClick={() => setTypes((t) => (t.includes(k) ? (t.length > 1 ? t.filter((x) => x !== k) : t) : [...t, k]))}
                    className={cn("rounded-full border px-3 py-1 text-sm", types.includes(k) ? "border-primary bg-primary-soft text-primary" : "border-border")}
                  >
                    {v}
                  </button>
                ))}
            </div>
          </fieldset>
        )}
        {oral && !speechSupported && <Alert tone="info">Speech input isn&apos;t supported in this browser. You can type your answers instead (Chrome, Edge and Safari support speech).</Alert>}
        <Button size="lg" onClick={start} loading={phase === "loading"}>
          {phase === "loading" ? "Writing questions from your material…" : "Start"}
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Average score</p>
        <p className="mt-1 text-5xl font-semibold">{avg.toFixed(1)}/10</p>
        <p className="mt-2 text-sm text-muted">{scores.length} answers graded</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/decks/${deckId}`}>Back to deck</Link>
          </Button>
          <Button onClick={() => setPhase("setup")}>
            <RotateCcw /> New round
          </Button>
        </div>
      </div>
    );
  }

  const current = attempts[i];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span>
          Question {i + 1} of {attempts.length}
        </span>
        <Progress value={(i / attempts.length) * 100} className="h-1.5 flex-1" label="Exam progress" />
      </div>
      <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <Badge tone="primary">{TYPE_LABEL[current.questionType] ?? current.questionType}</Badge>
        <p className="mt-3 font-serif text-xl leading-relaxed sm:text-2xl">{current.question}</p>
      </div>

      {(phase === "answering" || phase === "grading") && (
        <div className="space-y-3">
          <Label htmlFor="exam-answer" className="sr-only">
            Your answer
          </Label>
          <Textarea id="exam-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={oral ? "Press the microphone and answer aloud, or type here…" : "Write your answer…"} className="min-h-[200px] text-base" disabled={phase === "grading"} />
          <div className="flex flex-wrap items-center gap-2">
            {oral && speechSupported && (
              <Button variant={listening ? "danger" : "secondary"} onClick={toggleMic} disabled={phase === "grading"}>
                {listening ? <MicOff /> : <Mic />} {listening ? "Stop recording" : "Speak answer"}
              </Button>
            )}
            <Button onClick={submit} disabled={!answer.trim()} loading={phase === "grading"}>
              {phase === "grading" ? "Grading…" : "Submit answer"}
            </Button>
            {listening && (
              <span className="flex items-center gap-2 text-sm text-danger">
                <span className="size-2 animate-pulse rounded-full bg-danger" /> Listening…
              </span>
            )}
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div className="rounded-2xl border border-border bg-surface p-5 text-center">
              <p className="text-sm text-muted">Score</p>
              <p className="text-4xl font-semibold">{result.attempt.total.toFixed(1)}/10</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
              {Object.entries(result.attempt.scores).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 text-muted">{SCORE_LABEL[k] ?? k}</span>
                  <Progress value={v * 10} tone={v >= 7 ? "success" : v >= 5 ? "warning" : "danger"} label={`${SCORE_LABEL[k]} ${v}/10`} />
                  <span className="w-10 text-right tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="rounded-2xl bg-surface-2 p-4 text-sm">{result.attempt.feedback.summary}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="mb-2 text-sm font-medium">Your answer</p>
              <p className="whitespace-pre-wrap text-sm text-fg/80">{result.attempt.userAnswer}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="mb-2 text-sm font-medium">{result.attempt.modelAnswer ? "Model answer" : "Reference"}</p>
              <p className="text-sm text-fg/80">{result.attempt.modelAnswer || "Follow-up questions are graded directly against your source passages below."}</p>
              {result.attempt.keyPoints.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
                  {result.attempt.keyPoints.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FeedbackList title="Concepts you covered" items={result.attempt.feedback.covered} tone="success" />
            <FeedbackList title="Missing concepts" items={result.attempt.feedback.missing} tone="warning" />
            <FeedbackList title="Inaccuracies" items={result.attempt.feedback.inaccuracies} tone="danger" empty="None found." />
          </div>
          <FeedbackList title="How to improve" items={result.attempt.feedback.suggestions} tone="primary" />
          {result.sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              Sources:
              {result.sources.map((s) => (
                <SourceButton key={s.id} sectionId={s.id} quote={null} page={s.pageStart} heading={s.heading} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {oral && result.attempt.followUp && (
              <Button onClick={() => next(true)}>
                Examiner follow-up <ArrowRight />
              </Button>
            )}
            <Button variant={oral && result.attempt.followUp ? "secondary" : "primary"} onClick={() => next(false)}>
              {i + 1 >= attempts.length ? "Finish" : "Next question"}
            </Button>
          </div>
          {oral && result.attempt.followUp && <p className="text-sm text-muted">Follow-up: “{result.attempt.followUp}”</p>}
        </div>
      )}
      {phase === "grading" && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> The examiner is reading your answer…
        </p>
      )}
      <p className="text-center text-xs text-muted">{deckName} · AI grading is guidance, not an official mark.</p>
    </div>
  );
}

function FeedbackList({ title, items, tone, empty = "—" }: { title: string; items: string[]; tone: "success" | "warning" | "danger" | "primary"; empty?: string }) {
  const color = { success: "text-success", warning: "text-warning", danger: "text-danger", primary: "text-primary" }[tone];
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className={cn("mb-2 text-sm font-medium", color)}>{title}</p>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}
