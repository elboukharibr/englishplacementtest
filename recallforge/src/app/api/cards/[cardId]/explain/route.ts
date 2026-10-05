import { db } from "@/lib/db";
import { withUser, ok } from "@/lib/api";
import { getAI } from "@/lib/ai";
import { assertQuota, incrementUsage } from "@/lib/billing/usage";
import { enforceRateLimit } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/errors";

export const POST = withUser<{ cardId: string }>(async (_req, user, { cardId }) => {
  const card = await db.card.findFirst({ where: { id: cardId, userId: user.id }, include: { sourceSection: true } });
  if (!card) throw new UserFacingError("Card not found.", 404);
  await enforceRateLimit(`ai:${user.id}`, 60, 600);
  await assertQuota(user, "ai");
  const s = card.sourceSection;
  const explanation = await getAI().explainAnswer(
    { question: card.question, answer: card.answer, chunk: s ? { id: s.id, heading: s.path ?? s.heading, text: s.text, pageStart: s.pageStart } : null },
    { userId: user.id, purpose: "explain_answer" },
  );
  await incrementUsage(user.id, "aiRequests", 1);
  return ok({ explanation });
});
