import { NextResponse, type NextRequest } from "next/server";
import { drainJobs } from "@/lib/jobs/runner";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Serverless fallback for the worker: drains the job queue for up to ~4.5 minutes. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const n = await drainJobs(`cron-${Date.now()}`, 270_000);
  return NextResponse.json({ processed: n });
}
