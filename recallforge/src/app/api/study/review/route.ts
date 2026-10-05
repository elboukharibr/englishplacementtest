import { z } from "zod/v4";
import { withUser, ok, parseBody } from "@/lib/api";
import { submitReview } from "@/lib/data/review";
import { enforceRateLimit } from "@/lib/rate-limit";

const Body = z.object({
  cardId: z.string(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  sessionId: z.string().nullable().optional(),
  durationMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
});

export const POST = withUser(async (req, user) => {
  await enforceRateLimit(`review:${user.id}`, 600, 600);
  const b = await parseBody(req, Body);
  const r = await submitReview(user.id, { ...b, targetRetention: user.targetRetention });
  return ok({ nextDue: r.nextDue, scheduledMins: r.scheduledMins, state: r.card.state });
});
