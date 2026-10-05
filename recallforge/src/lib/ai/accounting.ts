import { db } from "@/lib/db";
import { costMicros } from "./cost";
import { incrementUsageMany } from "@/lib/billing/usage";

/** Records one model call for cost tracking (admin margin metric) and the user's usage row. */
export async function recordAiCall(entry: {
  userId?: string | null;
  purpose: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}) {
  const cost = costMicros(entry.model, entry.tokensIn, entry.tokensOut);
  try {
    await db.aiCall.create({
      data: {
        userId: entry.userId ?? null,
        purpose: entry.purpose,
        provider: entry.provider,
        model: entry.model,
        tokensIn: entry.tokensIn,
        tokensOut: entry.tokensOut,
        costMicros: cost,
        latencyMs: entry.latencyMs,
        ok: entry.ok,
        error: entry.error?.slice(0, 500),
      },
    });
    if (entry.userId) {
      const exists = await db.user.findUnique({ where: { id: entry.userId }, select: { id: true } });
      if (exists) await incrementUsageMany(entry.userId, { tokensIn: entry.tokensIn, tokensOut: entry.tokensOut, costMicros: cost });
    }
  } catch (e) {
    console.error("[ai] failed to record usage", e);
  }
}
