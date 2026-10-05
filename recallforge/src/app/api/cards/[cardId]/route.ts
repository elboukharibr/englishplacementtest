import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody } from "@/lib/api";
import { ownedCard } from "@/lib/data/access";
import { CARD_TYPES, DIFFICULTIES } from "@/lib/ai/schemas";
import { embedCards } from "@/lib/data/cards";

const Patch = z.object({
  question: z.string().trim().min(1).max(600).optional(),
  answer: z.string().trim().min(1).max(800).optional(),
  cardType: z.enum(CARD_TYPES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  suspended: z.boolean().optional(),
  verified: z.literal(true).optional(),
  resetProgress: z.literal(true).optional(),
});

export const PATCH = withUser<{ cardId: string }>(async (req, user, { cardId }) => {
  const card = await ownedCard(user.id, cardId);
  const { verified, resetProgress, ...rest } = await parseBody(req, Patch);
  const textChanged = (rest.question && rest.question !== card.question) || (rest.answer && rest.answer !== card.answer);
  const updated = await db.card.update({
    where: { id: card.id },
    data: {
      ...rest,
      // A human edit or explicit check counts as verification.
      ...(verified || textChanged ? { needsVerification: false, confidenceLabel: card.origin === "ai" ? "high" : card.confidenceLabel } : {}),
      ...(resetProgress ? { state: "NEW", due: new Date(), stability: 0, srsDifficulty: 0, reps: 0, lapses: 0, learningSteps: 0, elapsedDays: 0, scheduledDays: 0, lastReview: null } : {}),
    },
  });
  if (textChanged) await embedCards(user.id, [updated]);
  return ok({ card: updated });
});

export const DELETE = withUser<{ cardId: string }>(async (_req, user, { cardId }) => {
  await ownedCard(user.id, cardId);
  await db.card.delete({ where: { id: cardId } });
  return ok();
});
