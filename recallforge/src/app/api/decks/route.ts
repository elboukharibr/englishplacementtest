import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, parseBody, ok, jsonError } from "@/lib/api";
import { ownedDocument } from "@/lib/data/access";
import { enqueue } from "@/lib/jobs/queue";
import { assertQuota } from "@/lib/billing/usage";
import { BASIC_CARD_TYPES, limitsFor } from "@/lib/billing/plans";
import { CARD_TYPES, DIFFICULTIES } from "@/lib/ai/schemas";
import { FOCUS_OPTIONS } from "@/lib/pipeline/focus";
import { QuotaError } from "@/lib/errors";

const Body = z.object({
  documentId: z.string().min(1),
  name: z.string().trim().min(1).max(160).optional(),
  count: z.number().int().min(5).max(200),
  difficulty: z.enum(DIFFICULTIES),
  studyGoal: z.enum(["quick_revision", "exam_preparation", "deep_understanding", "long_term_mastery"]),
  cardTypes: z.array(z.enum(CARD_TYPES)).min(1, "Pick at least one card style."),
  focus: z.array(z.enum(FOCUS_OPTIONS.map((f) => f.id) as [string, ...string[]])).min(1, "Pick at least one thing to generate."),
  folderId: z.string().nullable().optional(),
});

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, Body);
  const doc = await ownedDocument(user.id, body.documentId);
  if (doc.status !== "READY") return jsonError("This document hasn't finished processing yet.", 409, "not_ready");
  const limits = limitsFor(user.plan);
  const advanced = body.cardTypes.filter((t) => !(BASIC_CARD_TYPES as readonly string[]).includes(t));
  if (advanced.length && !limits.features.advancedCardTypes) {
    throw new QuotaError("Advanced card styles (comparisons, applications, scenarios…) are part of Pro.", "feature:advancedCardTypes", { plan: user.plan });
  }
  if (body.count > limits.maxCardsPerDeck) {
    throw new QuotaError(`The ${user.plan === "FREE" ? "Free" : "Pro"} plan generates up to ${limits.maxCardsPerDeck} cards per deck.`, "cards_per_deck", { plan: user.plan });
  }
  const quota = await assertQuota(user, "cards", 1);
  const count = Math.min(body.count, quota.remaining);
  if (body.folderId) {
    const folder = await db.folder.findFirst({ where: { id: body.folderId, userId: user.id } });
    if (!folder) return jsonError("Folder not found.", 404);
  }
  const deck = await db.deck.create({
    data: {
      userId: user.id,
      documentId: doc.id,
      folderId: body.folderId ?? null,
      name: body.name ?? doc.title,
      subject: doc.subject,
      difficulty: body.difficulty,
      studyGoal: body.studyGoal,
      status: "GENERATING",
      progress: 2,
      statusMessage: "Queued…",
      generationSettings: { count, difficulty: body.difficulty, studyGoal: body.studyGoal, cardTypes: body.cardTypes, focus: body.focus },
    },
  });
  await enqueue("generate_deck", { deckId: deck.id }, { userId: user.id, priority: limits.features.priorityProcessing });
  return ok({ id: deck.id, count, capped: count < body.count }, { status: 201 });
});
