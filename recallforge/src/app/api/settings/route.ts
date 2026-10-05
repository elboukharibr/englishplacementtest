import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { DIFFICULTIES } from "@/lib/ai/schemas";

const Body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  studyContext: z.enum(["university", "competitive_exam", "certification", "research", "language", "other"]).optional(),
  primaryGoal: z.enum(["memorize", "understand", "exam", "oral", "papers", "retention"]).optional(),
  examDate: z.string().nullable().optional(),
  dailyReviewGoal: z.number().int().min(5).max(1000).optional(),
  targetRetention: z.number().min(0.7).max(0.97).optional(),
  defaultDeckSize: z.number().int().min(10).max(200).optional(),
  defaultDifficulty: z.enum(DIFFICULTIES).optional(),
  preferredStudyTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  timezone: z.string().max(64).optional(),
  emailReminders: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  notificationPrefs: z.object({ due: z.boolean(), mastery: z.boolean(), inactive: z.boolean(), exam: z.boolean() }).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().max(200).optional(),
});

export const PATCH = withUser(async (req, user) => {
  const { currentPassword, newPassword, examDate, timezone, ...rest } = await parseBody(req, Body);
  const data: Record<string, unknown> = { ...rest };
  if (examDate !== undefined) {
    if (examDate === null || examDate === "") data.examDate = null;
    else {
      const d = new Date(`${examDate}T09:00:00Z`);
      if (Number.isNaN(d.getTime())) return jsonError("Invalid exam date.", 422);
      data.examDate = d;
    }
  }
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      data.timezone = timezone;
    } catch {
      return jsonError("Unknown time zone.", 422);
    }
  }
  if (newPassword) {
    if (user.passwordHash && !(currentPassword && (await verifyPassword(currentPassword, user.passwordHash)))) {
      return jsonError("Your current password is incorrect.", 403, "wrong_password");
    }
    const problem = passwordProblem(newPassword);
    if (problem) return jsonError(problem, 422, "weak_password");
    data.passwordHash = await hashPassword(newPassword);
  }
  await db.user.update({ where: { id: user.id }, data });
  return ok();
});
