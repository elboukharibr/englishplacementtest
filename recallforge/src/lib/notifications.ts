import { db } from "@/lib/db";

export type NotificationKind = "due" | "mastery" | "inactive" | "exam" | "system";

export async function notify(userId: string, n: { kind: NotificationKind; title: string; body?: string; href?: string; dedupeKey?: string }) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;
  if (n.kind !== "system" && prefs[n.kind] === false) return;
  try {
    await db.notification.create({ data: { userId, ...n } });
  } catch {
    // Unique (userId, dedupeKey) violation → already notified. That's fine.
  }
}
