// Postgres-backed job queue. Claims with FOR UPDATE SKIP LOCKED so several workers can
// run safely in parallel. No HTTP request ever waits for document processing.
import type { Job, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export type JobType = "process_document" | "generate_deck" | "daily_maintenance";

const STALE_LOCK_MINUTES = 15;

export async function enqueue(type: JobType, payload: Prisma.InputJsonValue, opts: { userId?: string; priority?: boolean; runAt?: Date; maxAttempts?: number } = {}) {
  // Priority processing (Pro): jobs are back-dated so they sort ahead of the queue.
  const runAt = opts.runAt ?? new Date(Date.now() - (opts.priority ? 120_000 : 0));
  const job = await db.job.create({ data: { type, payload, userId: opts.userId, runAt, maxAttempts: opts.maxAttempts ?? 3 } });
  if (env.inlineJobs) kickInline();
  return job;
}

export async function claimJob(workerId: string): Promise<Job | null> {
  // Recover jobs whose worker died mid-run.
  await db.$executeRaw`
    UPDATE "Job" SET "status" = 'QUEUED', "lockedAt" = NULL, "lockedBy" = NULL
    WHERE "status" = 'RUNNING' AND "lockedAt" < now() - (${STALE_LOCK_MINUTES} * interval '1 minute')`;
  const rows = await db.$queryRaw<Job[]>`
    UPDATE "Job" SET "status" = 'RUNNING', "lockedAt" = now(), "lockedBy" = ${workerId}, "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" = (
      SELECT "id" FROM "Job" WHERE "status" = 'QUEUED' AND "runAt" <= now()
      ORDER BY "runAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *`;
  return rows[0] ?? null;
}

export async function completeJob(id: string) {
  await db.job.update({ where: { id }, data: { status: "SUCCEEDED", finishedAt: new Date(), lockedAt: null } });
}

export async function failJob(job: Job, error: string, retryable: boolean) {
  const canRetry = retryable && job.attempts < job.maxAttempts;
  await db.job.update({
    where: { id: job.id },
    data: canRetry
      ? { status: "QUEUED", lastError: error, lockedAt: null, lockedBy: null, runAt: new Date(Date.now() + 2 ** job.attempts * 15_000) }
      : { status: "FAILED", lastError: error, finishedAt: new Date(), lockedAt: null },
  });
  return canRetry;
}

// ── Inline mode (development / single-instance deployments) ──
let draining = false;
function kickInline() {
  if (draining) return;
  draining = true;
  setTimeout(async () => {
    try {
      const { drainJobs } = await import("./runner");
      await drainJobs(`inline-${process.pid}`, 10 * 60_000);
    } catch (e) {
      console.error("[jobs] inline drain failed", e);
    } finally {
      draining = false;
    }
  }, 10);
}
