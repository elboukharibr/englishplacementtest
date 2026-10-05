import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";
import { getAI } from "@/lib/ai";
import { sourcesForAttempt } from "@/lib/data/exam";
import { assertQuota, incrementUsage } from "@/lib/billing/usage";
import { enforceRateLimit } from "@/lib/rate-limit";

const Body = z.object({ answer: z.string().trim().min(1, "Write an answer first.").max(8000) });

export const POST = withUser<{ attemptId: string }>(async (req, user, { attemptId }) => {
  const attempt = await db.examAttempt.findFirst({ where: { id: attemptId, userId: user.id } });
  if (!attempt) return jsonError("Question not found.", 404);
  if (attempt.answeredAt) return jsonError("You've already answered this question.", 409);
  const { answer } = await parseBody(req, Body);
  await enforceRateLimit(`ai:${user.id}`, 60, 600);
  await assertQuota(user, "ai");
  const sources = await sourcesForAttempt(user.id, attempt);
  const ev = await getAI().evaluateAnswer(
    {
      question: attempt.question,
      modelAnswer: attempt.modelAnswer || "Not provided — judge strictly against the source passages.",
      keyPoints: attempt.keyPoints,
      sources,
      userAnswer: answer,
      oral: attempt.mode === "oral",
    },
    { userId: user.id, purpose: "evaluate_answer" },
  );
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(10, n)) * 10) / 10;
  const scores = { accuracy: clamp(ev.scores.accuracy), completeness: clamp(ev.scores.completeness), terminology: clamp(ev.scores.terminology), reasoning: clamp(ev.scores.reasoning) };
  const updated = await db.examAttempt.update({
    where: { id: attempt.id },
    data: {
      userAnswer: answer,
      answeredAt: new Date(),
      scores,
      total: clamp(ev.overall),
      followUp: ev.follow_up_question || null,
      feedback: { covered: ev.concepts_covered, missing: ev.missing_concepts, inaccuracies: ev.inaccuracies, suggestions: ev.suggestions, summary: ev.summary },
    },
  });
  await incrementUsage(user.id, "aiRequests", 1);
  return ok({
    attempt: updated,
    sources: sources.map((s) => ({ id: s.id, heading: s.heading, pageStart: s.pageStart ?? null })),
  });
});
