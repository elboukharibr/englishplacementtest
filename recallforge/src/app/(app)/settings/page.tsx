import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { PageHeader } from "@/components/ui/misc";
import { SettingsForms } from "@/components/app/settings-forms";

export const metadata: Metadata = { title: "Settings" };

const NAV = [
  ["#profile", "Profile"],
  ["#study", "Study preferences"],
  ["#review", "Review settings"],
  ["#notifications", "Notifications"],
  ["/settings/billing", "Billing"],
  ["/decks", "Export"],
  ["#privacy", "Privacy"],
  ["#account", "Account"],
];

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const prefs = (user.notificationPrefs ?? {}) as Record<string, boolean>;
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5 text-sm">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="block rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-fg">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SettingsForms
          initial={{
            name: user.name ?? "",
            email: user.email,
            hasPassword: Boolean(user.passwordHash),
            studyContext: user.studyContext ?? "university",
            primaryGoal: user.primaryGoal ?? "exam",
            examDate: user.examDate?.toISOString().slice(0, 10) ?? "",
            dailyReviewGoal: user.dailyReviewGoal,
            targetRetention: user.targetRetention,
            defaultDeckSize: user.defaultDeckSize,
            defaultDifficulty: user.defaultDifficulty,
            preferredStudyTime: user.preferredStudyTime ?? "",
            timezone: user.timezone,
            emailReminders: user.emailReminders,
            reducedMotion: user.reducedMotion,
            notificationPrefs: { due: prefs.due !== false, mastery: prefs.mastery !== false, inactive: prefs.inactive !== false, exam: prefs.exam !== false },
            emailConfigured: features.email(),
          }}
        />
      </div>
    </div>
  );
}
