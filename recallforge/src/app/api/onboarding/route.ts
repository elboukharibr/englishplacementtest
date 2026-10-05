import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, parseBody, ok } from "@/lib/api";
import { ensureSampleDeck } from "@/lib/data/sample";
import { track } from "@/lib/events";

const Body = z.object({
  studyContext: z.enum(["university", "competitive_exam", "certification", "research", "language", "other"]),
  primaryGoal: z.enum(["memorize", "understand", "exam", "oral", "papers", "retention"]),
  examDate: z.string().nullable().optional(),
  timezone: z.string().max(64).optional(),
});

const RETENTION_BY_GOAL: Record<string, number> = { exam: 0.9, oral: 0.9, retention: 0.9, memorize: 0.9, understand: 0.88, papers: 0.88 };

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, Body);
  let examDate: Date | null = null;
  if (body.examDate) {
    const d = new Date(`${body.examDate}T09:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d > new Date()) examDate = d;
  }
  let timezone = user.timezone;
  try {
    if (body.timezone) {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
      timezone = body.timezone;
    }
  } catch {
    /* ignore invalid tz */
  }
  await db.user.update({
    where: { id: user.id },
    data: { studyContext: body.studyContext, primaryGoal: body.primaryGoal, examDate, timezone, onboardedAt: new Date(), targetRetention: RETENTION_BY_GOAL[body.primaryGoal] ?? 0.9 },
  });
  await ensureSampleDeck(user.id);
  await track("onboarding_completed", user.id, { context: body.studyContext, goal: body.primaryGoal, hasExamDate: Boolean(examDate) });
  return ok({ ok: true, redirect: "/dashboard" });
});
