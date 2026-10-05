import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody } from "@/lib/api";
import { ownedDeck } from "@/lib/data/access";
import { examSources } from "@/lib/data/exam";
import { getAI } from "@/lib/ai";
import { EXAM_QUESTION_TYPES } from "@/lib/ai/schemas";
import { assertFeature, assertQuota, incrementUsage } from "@/lib/billing/usage";
import { enforceRateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/events";
import { UserFacingError } from "@/lib/errors";

const Body = z.object({
  count: z.number().int().min(1).max(10).default(5),
  types: z.array(z.enum(EXAM_QUESTION_TYPES)).min(1).default(["short_answer", "explanation", "compare_contrast", "analytical", "scenario"]),
  oral: z.boolean().default(false),
});

export const POST = withUser<{ deckId: string }>(async (req, user, { deckId }) => {
  const deck = await ownedDeck(user.id, deckId);
  const b = await parseBody(req, Body);
  if (!deck.isSample) assertFeature(user, b.oral ? "oralExam" : "examMode");
  await enforceRateLimit(`ai:${user.id}`, 60, 600);
  await assertQuota(user, "ai");
  const { chunks, concepts } = await examSources(user.id, deck);
  if (!chunks.length) throw new UserFacingError("This deck has no source material to build exam questions from.", 422);
  const questions = await getAI().generateQuestions(
    { chunks, concepts, count: b.oral ? Math.min(b.count, 3) : b.count, types: b.oral ? ["explanation", "analytical", "compare_contrast"] : b.types, difficulty: (deck.difficulty as never) ?? "intermediate" },
    { userId: user.id, purpose: b.oral ? "oral_questions" : "exam_questions" },
  );
  if (!questions.length) throw new UserFacingError("We couldn't write exam questions from this material. Try again.", 502);
  const valid = new Set(chunks.map((c) => c.id));
  const attempts = await db.$transaction(
    questions.map((q) =>
      db.examAttempt.create({
        data: {
          userId: user.id,
          deckId,
          mode: b.oral ? "oral" : "written",
          questionType: q.question_type,
          question: q.question,
          modelAnswer: q.model_answer,
          keyPoints: q.key_points.slice(0, 8),
          sourceSectionIds: q.source_chunk_ids.filter((id) => valid.has(id)),
        },
      }),
    ),
  );
  await incrementUsage(user.id, "aiRequests", 1);
  await track(b.oral ? "oral_exam_started" : "exam_mode_started", user.id, { questions: attempts.length });
  // Model answers are withheld until the learner submits.
  return ok({ attempts: attempts.map((a) => ({ id: a.id, question: a.question, questionType: a.questionType, mode: a.mode })) });
});
