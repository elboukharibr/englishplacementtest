// Standalone worker process: `npm run worker`. Polls the Postgres job queue.
// Run one or more of these alongside the web app (Railway, Fly.io, Render, a VM...).
import { drainJobs } from "./runner";
import { enqueue } from "./queue";
import { db } from "@/lib/db";

const workerId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
let stopping = false;

async function scheduleDaily() {
  const today = new Date().toISOString().slice(0, 10);
  const exists = await db.job.findFirst({ where: { type: "daily_maintenance", createdAt: { gte: new Date(`${today}T00:00:00Z`) } } });
  if (!exists) await enqueue("daily_maintenance", {}, { maxAttempts: 1 });
}

async function main() {
  console.log(`[worker] ${workerId} started`);
  process.on("SIGTERM", () => (stopping = true));
  process.on("SIGINT", () => (stopping = true));
  let lastDailyCheck = 0;
  while (!stopping) {
    if (Date.now() - lastDailyCheck > 10 * 60_000) {
      await scheduleDaily().catch((e) => console.error("[worker] schedule failed", e));
      lastDailyCheck = Date.now();
    }
    const n = await drainJobs(workerId, 60_000).catch((e) => {
      console.error("[worker] drain failed", e);
      return 0;
    });
    if (n === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  await db.$disconnect();
  console.log("[worker] stopped");
}

main();
