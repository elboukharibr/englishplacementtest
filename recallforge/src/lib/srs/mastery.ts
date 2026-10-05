// Mastery is derived from review performance, not from "cards viewed":
// card mastery = current recall probability × durability (stability relative to 21 days).
import type { Card } from "@prisma/client";
import { retrievability } from "./fsrs";

export const MATURE_DAYS = 21;

type M = Pick<Card, "state" | "stability" | "lastReview" | "lapses" | "reps">;

export function cardRecall(c: M, now = new Date()): number {
  if (c.state === "NEW" || !c.lastReview) return 0;
  const days = (now.getTime() - c.lastReview.getTime()) / 86400000;
  return retrievability(c.stability, days);
}

export function cardMastery(c: M, now = new Date()): number {
  if (c.state === "NEW" || !c.lastReview) return 0;
  const durability = Math.min(1, c.stability / MATURE_DAYS);
  // A card can't be "mastered" while it is still in (re)learning.
  const stateCap = c.state === "REVIEW" ? 1 : 0.5;
  return Math.min(stateCap, cardRecall(c, now) * (0.35 + 0.65 * durability));
}

export function isWeak(c: M, now = new Date()): boolean {
  if (c.state === "NEW" || !c.lastReview) return false;
  return c.state === "RELEARNING" || c.lapses >= 2 || cardRecall(c, now) < 0.7;
}

export type MasteryBreakdown = {
  total: number;
  mastery: number; // 0..1
  new: number;
  learning: number;
  young: number;
  mature: number;
  weak: number;
};

export function deckMastery(cards: M[], now = new Date()): MasteryBreakdown {
  const out: MasteryBreakdown = { total: cards.length, mastery: 0, new: 0, learning: 0, young: 0, mature: 0, weak: 0 };
  if (!cards.length) return out;
  let sum = 0;
  for (const c of cards) {
    sum += cardMastery(c, now);
    if (c.state === "NEW") out.new++;
    else if (c.state === "LEARNING" || c.state === "RELEARNING") out.learning++;
    else if (c.stability >= MATURE_DAYS) out.mature++;
    else out.young++;
    if (isWeak(c, now)) out.weak++;
  }
  out.mastery = sum / cards.length;
  return out;
}
