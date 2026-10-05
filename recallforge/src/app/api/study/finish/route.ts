import { z } from "zod/v4";
import { withUser, ok, parseBody } from "@/lib/api";
import { finishSession } from "@/lib/data/review";
import { improvementMoment } from "@/lib/data/analytics";
import { track } from "@/lib/events";

const Body = z.object({ sessionId: z.string() });

export const POST = withUser(async (req, user) => {
  const { sessionId } = await parseBody(req, Body);
  const s = await finishSession(user.id, sessionId);
  if (s) await track("study_completed", user.id, { mode: s.mode, cards: s.cardsReviewed, accuracy: s.accuracy });
  return ok({ session: s, improvement: s && !s.isSample ? await improvementMoment(user.id) : null });
});
