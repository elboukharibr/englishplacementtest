import { db } from "@/lib/db";
import { withUser, ok, jsonError } from "@/lib/api";

/** Oral mode: turns the examiner's follow-up question into a new attempt. */
export const POST = withUser<{ attemptId: string }>(async (_req, user, { attemptId }) => {
  const parent = await db.examAttempt.findFirst({ where: { id: attemptId, userId: user.id } });
  if (!parent?.followUp) return jsonError("There is no follow-up question for this answer.", 404);
  const existing = await db.examAttempt.findFirst({ where: { parentId: parent.id, userId: user.id } });
  if (existing) return ok({ attempt: { id: existing.id, question: existing.question, questionType: existing.questionType, mode: existing.mode } });
  const a = await db.examAttempt.create({
    data: {
      userId: user.id,
      deckId: parent.deckId,
      mode: parent.mode,
      questionType: "follow_up",
      question: parent.followUp,
      modelAnswer: "",
      keyPoints: [],
      sourceSectionIds: parent.sourceSectionIds,
      parentId: parent.id,
    },
  });
  return ok({ attempt: { id: a.id, question: a.question, questionType: a.questionType, mode: a.mode } });
});
