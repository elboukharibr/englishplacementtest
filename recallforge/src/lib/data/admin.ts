// Admin metrics. Revenue figures are computed from subscription rows (list prices), not
// from Stripe payouts, so treat them as estimates. Costs use AiCall records + env assumptions.
import { db } from "@/lib/db";
import { PRICING } from "@/lib/billing/plans";

const DAY = 86400000;

export async function adminMetrics(now = new Date()) {
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);
  const [users, proUsers, activeSubs, cancelled30, ai30, aiAll, storage, docs30, decks30, sessions30, failedJobs, queued] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { plan: "PRO" } }),
    db.subscription.findMany({ where: { status: { in: ["active", "trialing", "past_due"] }, provider: "stripe" }, select: { interval: true } }),
    db.subscription.count({ where: { status: "canceled", updatedAt: { gte: d30 } } }),
    db.aiCall.aggregate({ where: { createdAt: { gte: d30 } }, _sum: { costMicros: true, tokensIn: true, tokensOut: true }, _count: { _all: true } }),
    db.aiCall.aggregate({ _sum: { costMicros: true } }),
    db.document.aggregate({ _sum: { sizeBytes: true } }),
    db.document.count({ where: { createdAt: { gte: d30 }, isSample: false } }),
    db.deck.findMany({ where: { createdAt: { gte: d30 }, isSample: false, documentId: { not: null } }, select: { documentId: true } }),
    db.studySession.count({ where: { startedAt: { gte: d30 }, isSample: false, cardsReviewed: { gt: 0 } } }),
    db.job.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, type: true, lastError: true, updatedAt: true, attempts: true } }),
    db.job.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
  ]);
  const cardsGenerated30 = await db.card.count({ where: { origin: "ai", createdAt: { gte: d30 } } });
  const cardsStudied30 = await db.card.count({ where: { origin: "ai", createdAt: { gte: d30 }, reps: { gt: 0 } } });
  const failed30 = await db.job.count({ where: { status: "FAILED", updatedAt: { gte: d30 } } });

  const mrr = activeSubs.reduce((n, s) => n + (s.interval === "year" ? PRICING.yearly.amount / 12 : PRICING.monthly.amount), 0);
  const aiCost30 = (ai30._sum.costMicros ?? 0) / 1e6;
  const storageGb = (storage._sum.sizeBytes ?? 0) / 1e9;
  const storageCost = storageGb * Number(process.env.STORAGE_COST_PER_GB_MONTH ?? 0.015);
  const infraCost = Number(process.env.INFRA_MONTHLY_COST_USD ?? 0);
  const activeLearners30 = (await db.cardReview.groupBy({ by: ["userId"], where: { reviewedAt: { gte: d30 }, isSample: false } })).length;

  // North star: weekly active learners who completed a review session.
  const wal = (await db.studySession.groupBy({ by: ["userId"], where: { startedAt: { gte: d7 }, isSample: false, cardsReviewed: { gt: 0 }, endedAt: { not: null } } })).length;
  const reviews7 = await db.cardReview.count({ where: { reviewedAt: { gte: d7 }, isSample: false } });

  // Retention cohorts: users who signed up long enough ago, and reviewed again on/after day N.
  async function retention(days: number) {
    const cohort = await db.user.findMany({ where: { createdAt: { lte: new Date(now.getTime() - days * DAY), gte: new Date(now.getTime() - (days + 30) * DAY) } }, select: { id: true, createdAt: true } });
    if (!cohort.length) return null;
    let retained = 0;
    for (const u of cohort) {
      const r = await db.cardReview.findFirst({ where: { userId: u.id, isSample: false, reviewedAt: { gte: new Date(u.createdAt.getTime() + days * DAY) } }, select: { id: true } });
      if (r) retained++;
    }
    return { rate: retained / cohort.length, cohort: cohort.length };
  }

  const docsWithDeck = new Set(decks30.map((d) => d.documentId)).size;
  return {
    users,
    proUsers,
    activeSubscribers: activeSubs.length,
    mrr,
    arr: mrr * 12,
    conversion: users ? proUsers / users : 0,
    churn30: activeSubs.length + cancelled30 ? cancelled30 / (activeSubs.length + cancelled30) : 0,
    documents30: docs30,
    cardsGenerated30,
    aiCalls30: ai30._count._all,
    aiCost30,
    aiCostAllTime: (aiAll._sum.costMicros ?? 0) / 1e6,
    tokens30: (ai30._sum.tokensIn ?? 0) + (ai30._sum.tokensOut ?? 0),
    storageGb,
    storageCost,
    infraCost,
    contributionMargin: mrr - aiCost30 - storageCost - infraCost,
    avgAiCostPerActiveLearner: activeLearners30 ? aiCost30 / activeLearners30 : 0,
    arpu: users ? mrr / users : 0,
    sessions30,
    northStar: wal,
    reviewsPerLearnerWeek: wal ? reviews7 / wal : 0,
    docToDeckConversion: docs30 ? docsWithDeck / docs30 : 0,
    generatedCardsStudied: cardsGenerated30 ? cardsStudied30 / cardsGenerated30 : 0,
    retention7: await retention(7),
    retention30: await retention(30),
    failed30,
    queued,
    failedJobs,
  };
}

export async function eventCounts(days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await db.productEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since } }, _count: { _all: true } });
  return rows.map((r) => ({ name: r.name, count: r._count._all })).sort((a, b) => b.count - a.count);
}
