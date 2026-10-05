// Learner analytics. Sample-deck activity is excluded everywhere (isSample = false).
import { db } from "@/lib/db";
import { cardMastery, cardRecall, deckMastery, isWeak } from "@/lib/srs/mastery";

export function dayKey(d: Date, timeZone = "UTC") {
  return d.toLocaleDateString("en-CA", { timeZone });
}

export async function studyStreak(userId: string, timeZone = "UTC", now = new Date()) {
  const since = new Date(now.getTime() - 400 * 86400000);
  const rows = await db.cardReview.findMany({ where: { userId, isSample: false, reviewedAt: { gte: since } }, select: { reviewedAt: true } });
  const days = new Set(rows.map((r) => dayKey(r.reviewedAt, timeZone)));
  let streak = 0;
  const cursor = new Date(now);
  // Today not studied yet doesn't break the streak.
  if (!days.has(dayKey(cursor, timeZone))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor, timeZone))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function dashboardStats(userId: string, timeZone = "UTC") {
  const now = new Date();
  const [documents, cards, streak, usage] = await Promise.all([
    db.document.count({ where: { userId, isSample: false } }),
    db.card.findMany({
      where: { userId, suspended: false, deck: { archived: false, isSample: false } },
      select: { state: true, stability: true, lastReview: true, lapses: true, reps: true, due: true },
    }),
    studyStreak(userId, timeZone, now),
    db.usage.findMany({ where: { userId }, select: { minutesSaved: true, periodStart: true, periodEnd: true } }),
  ]);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const reviewed = cards.filter((c) => c.state !== "NEW");
  const mastery = reviewed.length ? deckMastery(cards, now).mastery : null;
  const current = usage.find((u) => u.periodStart <= now && u.periodEnd > now);
  return {
    documents,
    cards: cards.length,
    dueToday: cards.filter((c) => c.state !== "NEW" && c.due <= endOfDay).length,
    newAvailable: cards.filter((c) => c.state === "NEW").length,
    mastery,
    streak,
    minutesSavedThisPeriod: current?.minutesSaved ?? 0,
    minutesSavedTotal: usage.reduce((n, u) => n + u.minutesSaved, 0),
  };
}

export async function reviewQueueSummary(userId: string) {
  const now = new Date();
  const due = await db.card.groupBy({
    by: ["deckId"],
    where: { userId, suspended: false, state: { not: "NEW" }, due: { lte: now }, deck: { archived: false, status: "READY" } },
    _count: { _all: true },
  });
  const decks = await db.deck.findMany({ where: { id: { in: due.map((d) => d.deckId) } }, select: { id: true, name: true, isSample: true } });
  // Average answer time from recent history; default 20s per card.
  const recent = await db.cardReview.aggregate({ where: { userId, durationMs: { not: null } }, _avg: { durationMs: true } });
  const secondsPerCard = Math.min(60, Math.max(8, (recent._avg.durationMs ?? 20000) / 1000));
  const total = due.reduce((n, d) => n + d._count._all, 0);
  return {
    total,
    estimatedMinutes: Math.max(1, Math.round((total * secondsPerCard) / 60)),
    decks: due
      .map((d) => ({ deckId: d.deckId, name: decks.find((x) => x.id === d.deckId)?.name ?? "Deck", isSample: decks.find((x) => x.id === d.deckId)?.isSample ?? false, due: d._count._all }))
      .sort((a, b) => b.due - a.due),
  };
}

export type WeakTopic = { topic: string; mastery: number; cards: number; lapses: number; deckId: string; deckName: string };

export async function weakTopics(userId: string, deckId?: string, limit = 6): Promise<WeakTopic[]> {
  const now = new Date();
  const cards = await db.card.findMany({
    where: { userId, suspended: false, state: { not: "NEW" }, deck: { archived: false, ...(deckId ? { id: deckId } : { isSample: false }) } },
    select: { topic: true, sourceHeading: true, state: true, stability: true, lastReview: true, lapses: true, reps: true, deckId: true, deck: { select: { name: true } } },
  });
  const groups = new Map<string, typeof cards>();
  for (const c of cards) {
    const key = `${c.deckId}::${c.topic ?? c.sourceHeading ?? "General"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const out: WeakTopic[] = [];
  for (const [key, cs] of groups) {
    const weakCount = cs.filter((c) => isWeak(c, now)).length;
    if (!weakCount) continue;
    const m = cs.reduce((n, c) => n + cardMastery(c, now), 0) / cs.length;
    out.push({ topic: key.split("::")[1], mastery: m, cards: cs.length, lapses: cs.reduce((n, c) => n + c.lapses, 0), deckId: cs[0].deckId, deckName: cs[0].deck.name });
  }
  return out.sort((a, b) => a.mastery - b.mastery || b.lapses - a.lapses).slice(0, limit);
}

/** Recall rate = share of reviews of previously-seen cards rated Hard/Good/Easy. */
function recallRate(rows: { rating: number; prevState: string }[]) {
  const relevant = rows.filter((r) => r.prevState !== "NEW");
  if (relevant.length < 5) return null;
  return relevant.filter((r) => r.rating >= 2).length / relevant.length;
}

export async function analyticsOverview(userId: string, timeZone = "UTC") {
  const now = new Date();
  const since = new Date(now.getTime() - 90 * 86400000);
  const reviews = await db.cardReview.findMany({
    where: { userId, isSample: false, reviewedAt: { gte: since } },
    select: { reviewedAt: true, rating: true, durationMs: true, prevState: true, state: true, stability: true, card: { select: { topic: true } } },
    orderBy: { reviewedAt: "asc" },
  });
  const allTime = await db.cardReview.aggregate({ where: { userId, isSample: false }, _count: { _all: true }, _sum: { durationMs: true } });
  const today = dayKey(now, timeZone);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const todayRows = reviews.filter((r) => dayKey(r.reviewedAt, timeZone) === today);
  const weekRows = reviews.filter((r) => r.reviewedAt >= weekAgo);
  const lastWeekRows = reviews.filter((r) => r.reviewedAt >= twoWeeksAgo && r.reviewedAt < weekAgo);

  // Daily series (last 30 days).
  const series: { date: string; reviews: number; minutes: number; recall: number | null }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = dayKey(new Date(now.getTime() - i * 86400000), timeZone);
    const rows = reviews.filter((r) => dayKey(r.reviewedAt, timeZone) === d);
    series.push({ date: d, reviews: rows.length, minutes: Math.round(rows.reduce((n, r) => n + (r.durationMs ?? 0), 0) / 60000), recall: recallRate(rows) });
  }

  const cards = await db.card.findMany({
    where: { userId, suspended: false, deck: { archived: false, isSample: false } },
    select: { topic: true, state: true, stability: true, lastReview: true, lapses: true, reps: true },
  });
  const breakdown = deckMastery(cards, now);
  const reviewedCards = cards.filter((c) => c.state !== "NEW");
  const retentionEstimate = reviewedCards.length
    ? reviewedCards.reduce((n, c) => n + cardRecall(c, now), 0) / reviewedCards.length
    : null;

  // Topic strength.
  const topicMap = new Map<string, { sum: number; n: number }>();
  for (const c of reviewedCards) {
    const t = c.topic ?? "General";
    const e = topicMap.get(t) ?? { sum: 0, n: 0 };
    e.sum += cardMastery(c, now);
    e.n++;
    topicMap.set(t, e);
  }
  const topics = [...topicMap.entries()].filter(([, v]) => v.n >= 2).map(([topic, v]) => ({ topic, mastery: v.sum / v.n, cards: v.n }));
  topics.sort((a, b) => b.mastery - a.mastery);

  return {
    today: { reviewed: todayRows.length, minutes: Math.round(todayRows.reduce((n, r) => n + (r.durationMs ?? 0), 0) / 60000), accuracy: recallRate(todayRows) },
    week: {
      minutes: Math.round(weekRows.reduce((n, r) => n + (r.durationMs ?? 0), 0) / 60000),
      reviews: weekRows.length,
      cardsMastered: weekRows.filter((r) => r.state === "REVIEW" && r.stability >= 21).length,
      recall: recallRate(weekRows),
      lastWeekRecall: recallRate(lastWeekRows),
    },
    longTerm: {
      totalMinutes: Math.round((allTime._sum.durationMs ?? 0) / 60000),
      totalReviews: allTime._count._all,
      averageRecall: recallRate(reviews),
      retentionEstimate,
      streak: await studyStreak(userId, timeZone, now),
    },
    breakdown,
    series,
    strongest: topics.slice(0, 5),
    weakest: [...topics].reverse().slice(0, 5),
  };
}

/** The "You're getting stronger" moment: compares recall last week vs. the last 2 days. */
export async function improvementMoment(userId: string) {
  const now = new Date();
  const rows = await db.cardReview.findMany({
    where: { userId, isSample: false, reviewedAt: { gte: new Date(now.getTime() - 14 * 86400000) } },
    select: { reviewedAt: true, rating: true, prevState: true, card: { select: { topic: true } } },
  });
  const recent = rows.filter((r) => r.reviewedAt >= new Date(now.getTime() - 2 * 86400000));
  const earlier = rows.filter((r) => r.reviewedAt < new Date(now.getTime() - 5 * 86400000));
  const before = recallRate(earlier);
  const after = recallRate(recent);
  if (before == null || after == null || after - before < 0.05) return null;
  const byTopic = (rs: typeof rows) => {
    const m = new Map<string, { ok: number; n: number }>();
    for (const r of rs.filter((x) => x.prevState !== "NEW")) {
      const t = r.card.topic ?? "General";
      const e = m.get(t) ?? { ok: 0, n: 0 };
      e.n++;
      if (r.rating >= 2) e.ok++;
      m.set(t, e);
    }
    return m;
  };
  const a = byTopic(earlier);
  const b = byTopic(recent);
  let best: { topic: string; delta: number } | null = null;
  for (const [t, e] of b) {
    const prev = a.get(t);
    if (!prev || prev.n < 3 || e.n < 3) continue;
    const delta = e.ok / e.n - prev.ok / prev.n;
    if (!best || delta > best.delta) best = { topic: t, delta };
  }
  return { before, after, strongest: best && best.delta > 0 ? best : null };
}
