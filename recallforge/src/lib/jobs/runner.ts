import { claimJob, completeJob, failJob } from "./queue";
import { handlers } from "./handlers";
import { AIResponseError, AIUnavailableError } from "@/lib/ai/types";
import { PermanentJobError, UserFacingError } from "@/lib/errors";

function isRetryable(e: unknown): boolean {
  if (e instanceof PermanentJobError || e instanceof UserFacingError || e instanceof AIUnavailableError) return false;
  if (e instanceof AIResponseError) return e.retryable;
  return true;
}

/** Runs jobs until the queue is empty or the time budget is spent. Returns the number processed. */
export async function drainJobs(workerId: string, budgetMs: number): Promise<number> {
  const deadline = Date.now() + budgetMs;
  let n = 0;
  while (Date.now() < deadline) {
    const job = await claimJob(workerId);
    if (!job) break;
    n++;
    const handler = handlers[job.type as keyof typeof handlers];
    try {
      if (!handler) throw new PermanentJobError(`Unknown job type ${job.type}`);
      await handler(job.payload as never, job);
      await completeJob(job.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[jobs] ${job.type} ${job.id} failed (attempt ${job.attempts}):`, msg);
      const willRetry = await failJob(job, msg, isRetryable(e));
      if (!willRetry && handler?.onFinalFailure) await handler.onFinalFailure(job.payload as never, e).catch(() => {});
      else if (willRetry && handler?.onRetry) await handler.onRetry(job.payload as never, e).catch(() => {});
    }
  }
  return n;
}
