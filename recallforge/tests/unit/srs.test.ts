import { describe, it, expect } from "vitest";
import type { CardState } from "@prisma/client";
import { applyReview, previewIntervals, retrievability } from "@/lib/srs/fsrs";
import { cardMastery, deckMastery, isWeak } from "@/lib/srs/mastery";

const fresh = () => ({ state: "NEW" as CardState, due: new Date(), stability: 0, srsDifficulty: 0, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0, lastReview: null as Date | null });

describe("FSRS scheduling", () => {
  const now = new Date("2026-01-10T09:00:00Z");

  it("orders first intervals Again < Hard < Good < Easy, with Again ≈ 10 minutes", () => {
    const iv = previewIntervals(fresh(), now);
    expect(iv[1]).toBeGreaterThanOrEqual(9);
    expect(iv[1]).toBeLessThanOrEqual(11);
    expect(iv[1]).toBeLessThanOrEqual(iv[2]);
    expect(iv[2]).toBeLessThan(iv[3]);
    expect(iv[3]).toBeLessThan(iv[4]);
    expect(iv[4]).toBeGreaterThanOrEqual(1440 * 3);
  });

  it("grows intervals adaptively with successful reviews and shrinks after a lapse", () => {
    let c = applyReview(fresh(), 3, now).next;
    let t = c.due;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      const out = applyReview(c, 3, t);
      intervals.push(out.scheduledDays);
      c = out.next;
      t = c.due;
    }
    expect(c.state).toBe("REVIEW");
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    const lapse = applyReview(c, 1, t);
    expect(lapse.next.lapses).toBe(1);
    expect(lapse.next.state).toBe("RELEARNING");
    expect(lapse.next.stability).toBeLessThan(c.stability);
    expect(lapse.scheduledMins).toBeLessThanOrEqual(15);
    expect(lapse.retrievability).toBeGreaterThan(0.5);
  });

  it("higher target retention schedules sooner", () => {
    let c = applyReview(fresh(), 3, now).next;
    c = applyReview(c, 3, c.due).next;
    const lo = applyReview(c, 3, c.due, 0.8).scheduledDays;
    const hi = applyReview(c, 3, c.due, 0.95).scheduledDays;
    expect(hi).toBeLessThan(lo);
  });

  it("forgetting curve decreases with time", () => {
    expect(retrievability(10, 0)).toBeCloseTo(1);
    expect(retrievability(10, 10)).toBeGreaterThan(retrievability(10, 30));
  });
});

describe("mastery", () => {
  const now = new Date("2026-02-01T00:00:00Z");
  it("is zero for new cards and higher for stable, recently reviewed cards", () => {
    expect(cardMastery({ state: "NEW", stability: 0, lastReview: null, lapses: 0, reps: 0 }, now)).toBe(0);
    const strong = cardMastery({ state: "REVIEW", stability: 40, lastReview: new Date(now.getTime() - 2 * 86400000), lapses: 0, reps: 6 }, now);
    const young = cardMastery({ state: "REVIEW", stability: 3, lastReview: new Date(now.getTime() - 2 * 86400000), lapses: 0, reps: 2 }, now);
    expect(strong).toBeGreaterThan(young);
    expect(strong).toBeGreaterThan(0.8);
  });
  it("categorises cards and flags weak ones", () => {
    const cards = [
      { state: "NEW" as const, stability: 0, lastReview: null, lapses: 0, reps: 0 },
      { state: "LEARNING" as const, stability: 0.5, lastReview: now, lapses: 0, reps: 1 },
      { state: "REVIEW" as const, stability: 5, lastReview: now, lapses: 0, reps: 3 },
      { state: "REVIEW" as const, stability: 30, lastReview: now, lapses: 0, reps: 6 },
      { state: "REVIEW" as const, stability: 2, lastReview: new Date(now.getTime() - 20 * 86400000), lapses: 3, reps: 8 },
    ];
    const m = deckMastery(cards, now);
    expect(m).toMatchObject({ total: 5, new: 1, learning: 1, young: 2, mature: 1 });
    expect(m.weak).toBe(1);
    expect(isWeak(cards[4], now)).toBe(true);
  });
});
