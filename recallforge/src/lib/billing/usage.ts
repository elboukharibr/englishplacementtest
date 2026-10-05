import type { Plan } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { QuotaError } from "@/lib/errors";
import { limitsFor, type Feature } from "./plans";

/** Free users: calendar month (UTC). Pro users: their Stripe billing period. */
export async function currentPeriod(userId: string, now = new Date()): Promise<{ start: Date; end: Date }> {
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ["active", "trialing", "past_due"] }, currentPeriodStart: { lte: now }, currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodEnd: "desc" },
  });
  if (sub?.currentPeriodStart && sub.currentPeriodEnd) return { start: sub.currentPeriodStart, end: sub.currentPeriodEnd };
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Ensures the usage row for the current period exists. Race-safe (INSERT … ON CONFLICT). */
async function ensureUsageRow(userId: string) {
  const period = await currentPeriod(userId);
  await db.$executeRaw`
    INSERT INTO "Usage" ("id", "userId", "periodStart", "periodEnd")
    VALUES (${"usg_" + randomUUID().replace(/-/g, "")}, ${userId}, ${period.start}, ${period.end})
    ON CONFLICT ("userId", "periodStart") DO NOTHING`;
  return period;
}

export async function getUsage(userId: string) {
  const period = await ensureUsageRow(userId);
  return db.usage.findUniqueOrThrow({ where: { userId_periodStart: { userId, periodStart: period.start } } });
}

export type UsageField = "documents" | "pages" | "cardsGenerated" | "aiRequests" | "minutesSaved";

const USAGE_COLUMNS: Record<string, string> = {
  documents: "documents",
  pages: "pages",
  cardsGenerated: "cardsGenerated",
  aiRequests: "aiRequests",
  minutesSaved: "minutesSaved",
  tokensIn: "tokensIn",
  tokensOut: "tokensOut",
  costMicros: "costMicros",
};

/** Atomically increments usage counters for the current period. */
export async function incrementUsage(userId: string, field: UsageField | "tokensIn" | "tokensOut" | "costMicros", by: number) {
  return incrementUsageMany(userId, { [field]: by });
}

export async function incrementUsageMany(userId: string, deltas: Partial<Record<UsageField | "tokensIn" | "tokensOut" | "costMicros", number>>) {
  const entries = Object.entries(deltas).filter(([k, v]) => USAGE_COLUMNS[k] && v);
  if (!entries.length) return;
  const period = await ensureUsageRow(userId);
  const sets = entries.map(([k], i) => `"${USAGE_COLUMNS[k]}" = "${USAGE_COLUMNS[k]}" + $${i + 3}`).join(", ");
  await db.$executeRawUnsafe(`UPDATE "Usage" SET ${sets} WHERE "userId" = $1 AND "periodStart" = $2`, userId, period.start, ...entries.map(([, v]) => Math.round(v!)));
}

export function minutesSavedFor(cards: number) {
  // Assumption (documented in README): writing one good card by hand, including finding the
  // source passage, takes ~2.5 minutes. We report this as an estimate, never as measured fact.
  return Math.round(cards * 2.5);
}

const QUOTA_MESSAGES = {
  documents: "You've reached your monthly document upload limit.",
  pages: "You've reached your monthly page-processing limit.",
  cards: "You've reached your monthly AI card limit.",
  ai: "You've reached your monthly AI assistant limit.",
};

export async function assertQuota(user: { id: string; plan: Plan }, kind: "documents" | "pages" | "cards" | "ai", amount = 1) {
  const limits = limitsFor(user.plan);
  const usage = await getUsage(user.id);
  const map = {
    documents: [usage.documents, limits.documentsPerPeriod],
    pages: [usage.pages, limits.pagesPerPeriod],
    cards: [usage.cardsGenerated, limits.cardsPerPeriod],
    ai: [usage.aiRequests, limits.aiRequestsPerPeriod],
  } as const;
  const [used, limit] = map[kind];
  if (used + amount > limit) {
    throw new QuotaError(QUOTA_MESSAGES[kind], kind, { used, limit, plan: user.plan, minutesSaved: usage.minutesSaved });
  }
  return { used, limit, remaining: limit - used };
}

export function assertFeature(user: { plan: Plan }, feature: Feature) {
  if (!limitsFor(user.plan).features[feature]) {
    throw new QuotaError("This feature is part of Pro.", `feature:${feature}`, { feature, plan: user.plan });
  }
}

export function hasFeature(user: { plan: Plan }, feature: Feature) {
  return limitsFor(user.plan).features[feature];
}
