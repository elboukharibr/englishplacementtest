import type { Card } from "@prisma/client";
import { db } from "@/lib/db";
import { applyReview, previewIntervals, type RatingValue } from "@/lib/srs/fsrs";
import { isWeak } from "@/lib/srs/mastery";
import { ownedCard } from "./access";
import { UserFacingError } from "@/lib/errors";

export type StudyCard = Pick<Card, "id" | "deckId" | "question" | "answer" | "cardType" | "sourcePage" | "sourceHeading" | "sourceQuote" | "sourceSectionId" | "confidenceLabel" | "needsVerification" | "state" | "topic"> & {
  deckName: string;
  intervals: Record<RatingValue, number>;
};

type Mode = "study" | "review" | "weak" | "cram";

/**
 * Builds a study queue. "study"/"review": due cards first (most overdue first), then new cards
 * up to the daily goal. "weak": cards with lapses or low predicted recall. "cram": every card.
 */
export async function buildQueue(userId: string, opts: { deckIds?: string[]; mode: Mode; limit?: number; topic?: string | null; targetRetention: number; newLimit?: number }) {
  const now = new Date();
  const limit = Math.min(opts.limit ?? 50, 200);
  const deckFilter = opts.deckIds?.length ? { deckId: { in: opts.deckIds } } : {};
  const base = { userId, suspended: false, deck: { archived: false, status: "READY" as const }, ...deckFilter, ...(opts.topic ? { topic: opts.topic } : {}) };
  let cards: (Card & { deck: { name: string } })[] = [];

  if (opts.mode === "weak") {
    const reviewed = await db.card.findMany({ where: { ...base, state: { not: "NEW" } }, include: { deck: { select: { name: true } } } });
    cards = reviewed.filter((c) => isWeak(c, now)).sort((a, b) => b.lapses - a.lapses).slice(0, limit);
  } else if (opts.mode === "cram") {
    cards = await db.card.findMany({ where: base, include: { deck: { select: { name: true } } }, orderBy: { importance: "desc" }, take: limit });
  } else {
    const due = await db.card.findMany({
      where: { ...base, state: { not: "NEW" }, due: { lte: now } },
      include: { deck: { select: { name: true } } },
      orderBy: { due: "asc" },
      take: limit,
    });
    const newLimit = Math.max(0, Math.min(limit - due.length, opts.newLimit ?? 20));
    const fresh = newLimit
      ? await db.card.findMany({
          where: { ...base, state: "NEW" },
          include: { deck: { select: { name: true } } },
          orderBy: [{ importance: "desc" }, { createdAt: "asc" }],
          take: newLimit,
        })
      : [];
    cards = [...due, ...fresh];
  }

  return cards.map<StudyCard>((c) => ({
    id: c.id,
    deckId: c.deckId,
    deckName: c.deck.name,
    question: c.question,
    answer: c.answer,
    cardType: c.cardType,
    sourcePage: c.sourcePage,
    sourceHeading: c.sourceHeading,
    sourceQuote: c.sourceQuote,
    sourceSectionId: c.sourceSectionId,
    confidenceLabel: c.confidenceLabel,
    needsVerification: c.needsVerification,
    state: c.state,
    topic: c.topic,
    intervals: previewIntervals(c, now, opts.targetRetention),
  }));
}

export async function startSession(userId: string, deckId: string | null, mode: string) {
  let isSample = false;
  if (deckId) {
    const deck = await db.deck.findFirst({ where: { id: deckId, userId }, select: { isSample: true } });
    if (!deck) throw new UserFacingError("Deck not found.", 404);
    isSample = deck.isSample;
  }
  return db.studySession.create({ data: { userId, deckId, mode, isSample } });
}

export async function submitReview(userId: string, input: { cardId: string; rating: RatingValue; sessionId?: string | null; durationMs?: number | null; targetRetention: number }) {
  const card = await ownedCard(userId, input.cardId);
  const deck = await db.deck.findUnique({ where: { id: card.deckId }, select: { isSample: true } });
  const now = new Date();
  const outcome = applyReview(card, input.rating, now, input.targetRetention);
  let sessionId: string | null = null;
  if (input.sessionId) {
    const s = await db.studySession.findFirst({ where: { id: input.sessionId, userId }, select: { id: true } });
    sessionId = s?.id ?? null;
  }
  const [updated] = await db.$transaction([
    db.card.update({ where: { id: card.id }, data: outcome.next }),
    db.cardReview.create({
      data: {
        cardId: card.id,
        userId,
        sessionId,
        rating: input.rating,
        reviewedAt: now,
        durationMs: input.durationMs ? Math.min(input.durationMs, 10 * 60_000) : null,
        prevState: card.state,
        state: outcome.next.state,
        scheduledDays: outcome.scheduledDays,
        scheduledMins: outcome.scheduledMins,
        stability: outcome.next.stability,
        difficulty: outcome.next.srsDifficulty,
        retrievability: outcome.retrievability,
        nextReview: outcome.next.due,
        isSample: deck?.isSample ?? false,
      },
    }),
    db.deck.update({ where: { id: card.deckId }, data: { lastStudiedAt: now } }),
    ...(sessionId
      ? [db.studySession.update({ where: { id: sessionId }, data: { cardsReviewed: { increment: 1 }, correct: { increment: input.rating >= 3 ? 1 : 0 }, endedAt: now } })]
      : []),
  ]);
  return { card: updated, nextDue: outcome.next.due, scheduledMins: outcome.scheduledMins };
}

export async function finishSession(userId: string, sessionId: string) {
  const s = await db.studySession.findFirst({ where: { id: sessionId, userId } });
  if (!s) return null;
  const accuracy = s.cardsReviewed ? s.correct / s.cardsReviewed : null;
  return db.studySession.update({ where: { id: s.id }, data: { endedAt: new Date(), accuracy } });
}
