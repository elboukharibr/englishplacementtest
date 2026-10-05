// Spaced repetition using FSRS (Free Spaced Repetition Scheduler) via ts-fsrs.
// FSRS models each card's memory with stability (S) and difficulty (D) and schedules the
// next review when predicted recall falls to the learner's target retention.
import { createEmptyCard, forgetting_curve, fsrs, generatorParameters, Rating, State, type Card as FsrsCard, type Grade } from "ts-fsrs";
import type { Card, CardState } from "@prisma/client";

const STATE_TO_DB: Record<State, CardState> = {
  [State.New]: "NEW",
  [State.Learning]: "LEARNING",
  [State.Review]: "REVIEW",
  [State.Relearning]: "RELEARNING",
};
const DB_TO_STATE: Record<CardState, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

export type RatingValue = 1 | 2 | 3 | 4;
export const RATING_LABELS: Record<RatingValue, { label: string; hint: string }> = {
  1: { label: "Again", hint: "I didn't know it." },
  2: { label: "Hard", hint: "I struggled." },
  3: { label: "Good", hint: "I remembered it." },
  4: { label: "Easy", hint: "I knew it instantly." },
};

type SchedFields = Pick<Card, "state" | "due" | "stability" | "srsDifficulty" | "elapsedDays" | "scheduledDays" | "learningSteps" | "reps" | "lapses" | "lastReview">;

function scheduler(targetRetention = 0.9) {
  return fsrs(
    generatorParameters({
      request_retention: Math.min(0.97, Math.max(0.7, targetRetention)),
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: ["10m"],
      relearning_steps: ["10m"],
      maximum_interval: 3650,
    }),
  );
}

function toFsrs(c: SchedFields, now: Date): FsrsCard {
  if (c.state === "NEW" && c.reps === 0) return createEmptyCard(now);
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.srsDifficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    learning_steps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    state: DB_TO_STATE[c.state],
    last_review: c.lastReview ?? undefined,
  };
}

export type ReviewOutcome = {
  next: SchedFields;
  retrievability: number | null;
  scheduledDays: number;
  scheduledMins: number;
};

export function applyReview(card: SchedFields, rating: RatingValue, now = new Date(), targetRetention = 0.9): ReviewOutcome {
  const f = scheduler(targetRetention);
  const current = toFsrs(card, now);
  const retrievability = card.state === "NEW" || !card.lastReview ? null : f.get_retrievability(current, now, false);
  const { card: n } = f.next(current, now, rating as unknown as Grade);
  const mins = Math.max(0, Math.round((n.due.getTime() - now.getTime()) / 60000));
  return {
    next: {
      state: STATE_TO_DB[n.state],
      due: n.due,
      stability: n.stability,
      srsDifficulty: n.difficulty,
      elapsedDays: n.elapsed_days,
      scheduledDays: n.scheduled_days,
      learningSteps: n.learning_steps,
      reps: n.reps,
      lapses: n.lapses,
      lastReview: now,
    },
    retrievability: typeof retrievability === "number" ? retrievability : null,
    scheduledDays: n.scheduled_days,
    scheduledMins: mins,
  };
}

/** Preview the interval each rating would produce — shown under the rating buttons. */
export function previewIntervals(card: SchedFields, now = new Date(), targetRetention = 0.9): Record<RatingValue, number> {
  const f = scheduler(targetRetention);
  const rec = f.repeat(toFsrs(card, now), now);
  const out = {} as Record<RatingValue, number>;
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
    out[r as RatingValue] = Math.max(0, Math.round((rec[r].card.due.getTime() - now.getTime()) / 60000));
  }
  return out;
}

/** FSRS forgetting curve: probability of recall after `days` with stability S. */
const DEFAULT_W = generatorParameters().w;
export function retrievability(stability: number, days: number): number {
  if (stability <= 0) return 0;
  return forgetting_curve(DEFAULT_W, Math.max(0, days), stability);
}

export function formatInterval(mins: number): string {
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  const days = mins / 1440;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
