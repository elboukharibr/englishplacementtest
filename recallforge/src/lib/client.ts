"use client";
// Browser fetch helper with uniform error handling. Quota errors raise a global upsell.

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export const QUOTA_EVENT = "rf:quota";

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: opts.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Network error — check your connection and try again.", 0, "network");
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const err = new ApiError(data.error ?? `Request failed (${res.status}).`, res.status, data.code, data.details);
    if (res.status === 402 && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(QUOTA_EVENT, { detail: { message: err.message, ...data.details } }));
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) window.location.href = "/login";
    throw err;
  }
  return data as T;
}
