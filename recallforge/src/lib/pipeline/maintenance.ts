// Daily maintenance: reminders (in-app + optional email) and housekeeping.
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { env, features } from "@/lib/env";
import { BRAND } from "@/lib/brand";

export async function dailyMaintenance(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const dueByUser = await db.card.groupBy({
    by: ["userId"],
    where: { due: { lte: endOfDay }, suspended: false, deck: { archived: false, isSample: false } },
    _count: { _all: true },
  });
  for (const row of dueByUser) {
    const n = row._count._all;
    await notify(row.userId, { kind: "due", title: `${n} card${n === 1 ? " is" : "s are"} due today.`, href: "/review", dedupeKey: `due-${today}` });
    const user = await db.user.findUnique({ where: { id: row.userId }, select: { email: true, emailReminders: true, notificationPrefs: true } });
    const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;
    if (user?.emailReminders && prefs.due !== false && features.email()) {
      await sendEmail({
        to: user.email,
        subject: `${n} cards are ready for review`,
        text: `You have ${n} cards due today in ${BRAND.name}.\n\nReview now: ${env.appUrl}/review\n\nYou can turn off these reminders in Settings → Notifications.`,
      });
    }
  }

  // Decks with due cards that haven't been studied for 4+ days.
  const stale = await db.deck.findMany({
    where: { archived: false, isSample: false, status: "READY", lastStudiedAt: { lt: new Date(now.getTime() - 4 * 86400000) }, cards: { some: { due: { lte: now } } } },
    select: { id: true, userId: true, name: true, lastStudiedAt: true },
    take: 5000,
  });
  for (const d of stale) {
    const days = Math.floor((now.getTime() - d.lastStudiedAt!.getTime()) / 86400000);
    await notify(d.userId, { kind: "inactive", title: `You haven't reviewed ${d.name} for ${days} days.`, href: `/study/${d.id}`, dedupeKey: `inactive-${d.id}-${today}` });
  }

  // Exam countdown reminders at meaningful milestones.
  const examUsers = await db.user.findMany({ where: { examDate: { gt: now } }, select: { id: true, examDate: true } });
  for (const u of examUsers) {
    const days = Math.ceil((u.examDate!.getTime() - now.getTime()) / 86400000);
    if ([30, 14, 7, 3, 1].includes(days)) {
      await notify(u.id, { kind: "exam", title: `Your exam is ${days} day${days === 1 ? "" : "s"} away.`, href: "/study-plan", dedupeKey: `exam-${days}-${u.examDate!.toISOString().slice(0, 10)}` });
    }
  }

  // Housekeeping.
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400000) } } });
  await db.job.deleteMany({ where: { status: "SUCCEEDED", finishedAt: { lt: new Date(now.getTime() - 14 * 86400000) } } });
}
