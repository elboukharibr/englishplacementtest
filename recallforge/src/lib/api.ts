// Route-handler helpers: authentication, uniform JSON errors, input validation.
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { ZodError, type z } from "zod/v4";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { QuotaError, UserFacingError } from "@/lib/errors";
import { AIResponseError, AIUnavailableError } from "@/lib/ai/types";
import { track } from "@/lib/events";
import { env } from "@/lib/env";

export function jsonError(message: string, status = 400, code?: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: message, code, details }, { status });
}

export function handleError(e: unknown, userId?: string | null) {
  if (e instanceof QuotaError) {
    void track("paywall_seen", userId ?? null, { quota: e.quota });
    return jsonError(e.message, 402, e.code, e.details);
  }
  if (e instanceof UserFacingError) return jsonError(e.message, e.status, e.code, e.details);
  if (e instanceof ZodError) return jsonError("Some fields are invalid.", 422, "invalid_input", { issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  if (e instanceof AIUnavailableError) return jsonError(e.message, 503, "ai_unavailable");
  if (e instanceof AIResponseError) return jsonError(e.message, 502, "ai_error");
  console.error("[api] unexpected error", e);
  return jsonError("Something went wrong on our side. Please try again.", 500, "internal");
}

type Ctx<P> = { params: Promise<P> };

export function withUser<P = Record<string, string>>(handler: (req: NextRequest, user: User, params: P) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    let user: User | null = null;
    try {
      // CSRF defence for cookie-authenticated mutations: require same-origin requests.
      if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) return jsonError("Cross-site request blocked.", 403, "csrf");
      user = await getCurrentUser();
      if (!user) return jsonError("Please sign in.", 401, "unauthenticated");
      return await handler(req, user, await ctx.params);
    } catch (e) {
      return handleError(e, user?.id);
    }
  };
}

export function withAdmin<P = Record<string, string>>(handler: (req: NextRequest, user: User, params: P) => Promise<Response>) {
  return withUser<P>(async (req, user, params) => {
    if (!isAdmin(user)) return jsonError("Not found.", 404);
    return handler(req, user, params);
  });
}

export function withPublic<P = Record<string, string>>(handler: (req: NextRequest, params: P) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (req.method !== "GET" && !sameOrigin(req)) return jsonError("Cross-site request blocked.", 403, "csrf");
      return await handler(req, await ctx.params);
    } catch (e) {
      return handleError(e);
    }
  };
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === host || o.origin === new URL(env.appUrl).origin;
  } catch {
    return false;
  }
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new UserFacingError("Invalid request body.", 400);
  }
  return schema.parse(raw);
}

export function ok(data: unknown = { ok: true }, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
