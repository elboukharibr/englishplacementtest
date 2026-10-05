// Exam-driven study plan. Recomputed from live card state every time it's viewed, so a
// missed day automatically spreads its backlog over the following days.
import { db } from "@/lib/db";
import { deckMastery } from "@/lib/srs/mastery";
import { addDays, startOfDay } from "@/lib/utils";

export type PlanDay = { date: string; total: number; reviews: number; newCards: number; decks: { deckId: string; name: string; count: number }[] };

export async function buildStudyPlan(user: { id: string; examDate: Date | null; dailyReviewGoal: number }, opts: { horizonDays?: number } = {}) {
  const now = new Date();
  const examDate = user.examDate && user.examDate > now ? user.examDate : null;
  const daysToExam = examDate ? Math.max(1, Math.ceil((examDate.getTime() - now.getTime()) / 86400000)) : null;
  const horizon = Math.min(opts.horizonDays ?? 14, daysToExam ?? 14);

  const cards = await db.card.findMany({
    where: { userId: user.id, suspended: false, deck: { archived: false, isSample: false, status: "READY" } },
    select: { id: true, deckId: true, state: true, due: true, stability: true, lastReview: true, lapses: true, reps: true, deck: { select: { name: true } } },
  });
  const breakdown = deckMastery(cards, now);
  const today0 = startOfDay(now);

  // New cards must all be introduced before the final review buffer (last 20% of days, ≥ 2 days).
  const newCards = cards.filter((c) => c.state === "NEW");
  const buffer = daysToExam ? Math.max(2, Math.round(daysToExam * 0.2)) : 0;
  const introDays = daysToExam ? Math.max(1, daysToExam - buffer) : Math.max(1, Math.ceil(newCards.length / 20));
  const newPerDay = Math.ceil(newCards.length / introDays);

  // Overdue backlog (missed sessions) is spread over the next 3 days instead of one huge day.
  const overdue = cards.filter((c) => c.state !== "NEW" && c.due < today0);
  const backlogPerDay = Math.ceil(overdue.length / 3);

  const days: PlanDay[] = [];
  const newQueue = [...newCards];
  for (let i = 0; i < horizon; i++) {
    const dayStart = addDays(today0, i);
    const dayEnd = addDays(today0, i + 1);
    const dueToday = cards.filter((c) => c.state !== "NEW" && c.due >= (i === 0 ? today0 : dayStart) && c.due < dayEnd);
    const backlog = i < 3 ? overdue.slice(i * backlogPerDay, (i + 1) * backlogPerDay) : [];
    const introducing = i < introDays ? newQueue.splice(0, newPerDay) : [];
    const all = [...dueToday, ...backlog, ...introducing];
    const perDeck = new Map<string, { name: string; count: number }>();
    for (const c of all) {
      const e = perDeck.get(c.deckId) ?? { name: c.deck.name, count: 0 };
      e.count++;
      perDeck.set(c.deckId, e);
    }
    days.push({
      date: dayStart.toISOString().slice(0, 10),
      total: all.length,
      reviews: dueToday.length + backlog.length,
      newCards: introducing.length,
      decks: [...perDeck.entries()].map(([deckId, v]) => ({ deckId, ...v })).sort((a, b) => b.count - a.count),
    });
  }

  const requiringReview = cards.filter((c) => c.state === "NEW" || c.due <= (examDate ?? addDays(now, 14))).length;
  const avgDaily = days.length ? Math.round(days.reduce((n, d) => n + d.total, 0) / days.length) : 0;
  return {
    examDate,
    daysToExam,
    currentMastery: breakdown.mastery,
    suggestedMastery: 0.9,
    cardsRequiringReview: requiringReview,
    estimatedDailyWorkload: avgDaily,
    overloaded: avgDaily > user.dailyReviewGoal * 1.5,
    overdue: overdue.length,
    newPerDay,
    days,
  };
}
