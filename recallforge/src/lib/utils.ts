import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatRelative(date: Date | string | null | undefined, now = new Date()): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = now.getTime() - d.getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let s: string;
  if (mins < 1) return "just now";
  if (mins < 60) s = `${mins} min`;
  else if (hours < 24) s = `${hours} h`;
  else if (days < 30) s = `${days} day${days === 1 ? "" : "s"}`;
  else return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return future ? `in ${s}` : `${s} ago`;
}

export function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${Math.round(n * 100)}%`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rough token estimate (≈4 chars/token for English prose). Used for chunking and quotas. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
