import { z } from "zod/v4";
import { withUser, ok, parseBody } from "@/lib/api";
import { IMPROVE_ACTIONS } from "@/lib/ai/schemas";
import { improveCard } from "@/lib/data/cards";
import { assertQuota, incrementUsage } from "@/lib/billing/usage";
import { enforceRateLimit } from "@/lib/rate-limit";

const Body = z.object({ action: z.enum(IMPROVE_ACTIONS) });

export const POST = withUser<{ cardId: string }>(async (req, user, { cardId }) => {
  const { action } = await parseBody(req, Body);
  await enforceRateLimit(`ai:${user.id}`, 60, 600);
  await assertQuota(user, "ai");
  const result = await improveCard(user.id, cardId, action);
  await incrementUsage(user.id, "aiRequests", 1);
  return ok(result);
});
