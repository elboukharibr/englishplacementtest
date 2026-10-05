import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody } from "@/lib/api";
import { buildQueue, startSession } from "@/lib/data/review";
import { track } from "@/lib/events";

const Body = z.object({
  deckIds: z.array(z.string()).max(50).optional(),
  mode: z.enum(["study", "review", "weak", "cram"]).default("study"),
  topic: z.string().max(200).nullable().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const POST = withUser(async (req, user) => {
  const b = await parseBody(req, Body);
  if (b.deckIds?.length) {
    const owned = await db.deck.count({ where: { id: { in: b.deckIds }, userId: user.id } });
    if (owned !== b.deckIds.length) return ok({ cards: [], sessionId: null });
  }
  const reviewedToday = await db.cardReview.count({ where: { userId: user.id, prevState: "NEW", reviewedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } });
  const cards = await buildQueue(user.id, {
    deckIds: b.deckIds,
    mode: b.mode,
    topic: b.topic,
    limit: b.limit ?? Math.max(20, user.dailyReviewGoal),
    targetRetention: user.targetRetention,
    newLimit: Math.max(0, Math.round(user.dailyReviewGoal * 0.4) - reviewedToday),
  });
  const session = cards.length ? await startSession(user.id, b.deckIds?.length === 1 ? b.deckIds[0] : null, b.mode) : null;
  if (session) await track("study_started", user.id, { mode: b.mode, cards: cards.length });
  return ok({ cards, sessionId: session?.id ?? null });
});
