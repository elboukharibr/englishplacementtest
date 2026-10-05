import { NextResponse, type NextRequest } from "next/server";
import { enqueue } from "@/lib/jobs/queue";
import { cronAuthorized } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = await enqueue("daily_maintenance", {}, { maxAttempts: 1 });
  return NextResponse.json({ queued: job.id });
}
