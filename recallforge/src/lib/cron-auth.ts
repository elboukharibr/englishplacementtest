import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/** Cron endpoints require `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically). */
export function cronAuthorized(req: NextRequest) {
  if (!env.cronSecret) return false;
  return req.headers.get("authorization") === `Bearer ${env.cronSecret}`;
}
