"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/client";

type S = {
  name: string;
  email: string;
  hasPassword: boolean;
  studyContext: string;
  primaryGoal: string;
  examDate: string;
  dailyReviewGoal: number;
  targetRetention: number;
  defaultDeckSize: number;
  defaultDifficulty: string;
  preferredStudyTime: string;
  timezone: string;
  emailReminders: boolean;
  reducedMotion: boolean;
  notificationPrefs: { due: boolean; mastery: boolean; inactive: boolean; exam: boolean };
  emailConfigured: boolean;
};

async function save(body: Record<string, unknown>, ok = "Saved.") {
  try {
    await api("/api/settings", { method: "PATCH", body });
    toast.success(ok);
    return true;
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : "Couldn't save.");
    return false;
  }
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SettingsForms({ initial }: { initial: S }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const set = <K extends keyof S>(k: K, v: S[K]) => setS((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState<string | null>(null);
  const [del, setDel] = useState<null | "account" | "ai">(null);
  const [confirm, setConfirm] = useState("");

  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    if (await save(body)) router.refresh();
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      <Section id="profile" title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="s-name">
            <Input id="s-name" value={s.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="s-email" hint="Contact support to change your email.">
            <Input id="s-email" value={s.email} disabled />
          </Field>
        </div>
        <Button className="mt-4" loading={busy === "profile"} onClick={() => run("profile", { name: s.name })}>
          Save profile
        </Button>
      </Section>

      <Section id="study" title="Study preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What are you studying?" htmlFor="s-ctx">
            <Select id="s-ctx" value={s.studyContext} onChange={(e) => set("studyContext", e.target.value)}>
              <option value="university">University course</option>
              <option value="competitive_exam">Competitive exam</option>
              <option value="certification">Professional certification</option>
              <option value="research">Research / PhD</option>
              <option value="language">Language learning</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Primary goal" htmlFor="s-goal">
            <Select id="s-goal" value={s.primaryGoal} onChange={(e) => set("primaryGoal", e.target.value)}>
              <option value="memorize">Memorize key concepts</option>
              <option value="understand">Understand complex material</option>
              <option value="exam">Prepare for an exam</option>
              <option value="oral">Prepare for an oral examination</option>
              <option value="papers">Learn research papers</option>
              <option value="retention">Long-term retention</option>
            </Select>
          </Field>
          <Field label="Exam date" htmlFor="s-exam">
            <Input id="s-exam" type="date" value={s.examDate} onChange={(e) => set("examDate", e.target.value)} />
          </Field>
          <Field label="Preferred study time" htmlFor="s-time">
            <Input id="s-time" type="time" value={s.preferredStudyTime} onChange={(e) => set("preferredStudyTime", e.target.value)} />
          </Field>
          <Field label="Default deck size" htmlFor="s-size">
            <Select id="s-size" value={s.defaultDeckSize} onChange={(e) => set("defaultDeckSize", Number(e.target.value))}>
              {[20, 40, 80, 120].map((n) => (
                <option key={n} value={n}>
                  {n} cards
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default difficulty" htmlFor="s-diff">
            <Select id="s-diff" value={s.defaultDifficulty} onChange={(e) => set("defaultDifficulty", e.target.value)}>
              {["basic", "intermediate", "advanced", "expert"].map((d) => (
                <option key={d} value={d}>
                  {d[0].toUpperCase() + d.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button
          className="mt-4"
          loading={busy === "study"}
          onClick={() =>
            run("study", { studyContext: s.studyContext, primaryGoal: s.primaryGoal, examDate: s.examDate || null, preferredStudyTime: s.preferredStudyTime || null, defaultDeckSize: s.defaultDeckSize, defaultDifficulty: s.defaultDifficulty })
          }
        >
          Save preferences
        </Button>
      </Section>

      <Section id="review" title="Review settings" description="Target retention is the recall probability FSRS aims for when it schedules a review. Higher means more reviews.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Daily review goal (cards)" htmlFor="s-daily" hint="Also limits new cards per day to about 40% of this.">
            <Input id="s-daily" type="number" min={5} max={1000} value={s.dailyReviewGoal} onChange={(e) => set("dailyReviewGoal", Number(e.target.value))} />
          </Field>
          <Field label={`Target retention: ${Math.round(s.targetRetention * 100)}%`} htmlFor="s-ret" hint="85–92% is a good range for most learners.">
            <input id="s-ret" type="range" min={0.8} max={0.95} step={0.01} value={s.targetRetention} onChange={(e) => set("targetRetention", Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </Field>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3 text-sm sm:col-span-2">
            Reduce motion (fewer animations)
            <Switch checked={s.reducedMotion} onCheckedChange={(v) => set("reducedMotion", v)} />
          </label>
        </div>
        <Button className="mt-4" loading={busy === "review"} onClick={() => run("review", { dailyReviewGoal: s.dailyReviewGoal, targetRetention: s.targetRetention, reducedMotion: s.reducedMotion })}>
          Save review settings
        </Button>
      </Section>

      <Section id="notifications" title="Notifications">
        <div className="space-y-2">
          {(
            [
              ["due", "Cards due today"],
              ["mastery", "Mastery changes"],
              ["inactive", "Decks you haven't reviewed for a while"],
              ["exam", "Exam countdown"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-4 rounded-xl border border-border p-3 text-sm">
              {label}
              <Switch checked={s.notificationPrefs[k]} onCheckedChange={(v) => set("notificationPrefs", { ...s.notificationPrefs, [k]: v })} />
            </label>
          ))}
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3 text-sm">
            <span>
              Email reminders
              {!s.emailConfigured && <span className="block text-xs text-muted">Email delivery isn&apos;t configured on this server yet.</span>}
            </span>
            <Switch checked={s.emailReminders} onCheckedChange={(v) => set("emailReminders", v)} />
          </label>
        </div>
        <Button className="mt-4" loading={busy === "notif"} onClick={() => run("notif", { notificationPrefs: s.notificationPrefs, emailReminders: s.emailReminders })}>
          Save notifications
        </Button>
      </Section>

      <Section id="account" title="Password">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy("pw");
            if (await save({ currentPassword: fd.get("current") || undefined, newPassword: fd.get("new") }, "Password updated.")) (e.target as HTMLFormElement).reset();
            setBusy(null);
          }}
        >
          {s.hasPassword && (
            <Field label="Current password" htmlFor="pw-current">
              <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
            </Field>
          )}
          <Field label={s.hasPassword ? "New password" : "Set a password"} htmlFor="pw-new" hint="At least 10 characters, with a number or symbol.">
            <Input id="pw-new" name="new" type="password" autoComplete="new-password" required />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy === "pw"}>
              Update password
            </Button>
          </div>
        </form>
      </Section>

      <Section id="privacy" title="Privacy & data" description="Your documents remain private and are used only to provide the service.">
        <div className="space-y-3 text-sm">
          <p>Delete individual documents from the Library and decks from their menu. You can also:</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDel("ai")}>
              Remove all AI-generated data
            </Button>
            <Button variant="danger" onClick={() => setDel("account")}>
              Delete my account
            </Button>
          </div>
        </div>
      </Section>

      <Dialog open={del === "ai"} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent title="Remove AI-generated data?" description="Deletes AI-generated cards (and their review history), extracted concepts, tutor conversations and exam answers. Your uploads, manual and imported cards stay.">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDel(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === "ai"}
              onClick={async () => {
                setBusy("ai");
                try {
                  const r = await api<{ cards: number }>("/api/account/ai-data", { method: "DELETE" });
                  toast.success(`Removed ${r.cards} AI cards and related data.`);
                  setDel(null);
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : "Couldn't remove data.");
                } finally {
                  setBusy(null);
                }
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={del === "account"} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent title="Delete your account?" description="This permanently deletes your files, decks, cards, review history and analytics, and cancels any subscription. It can't be undone.">
          <Field label='Type "DELETE" to confirm' htmlFor="del-confirm">
            <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDel(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirm !== "DELETE"}
              loading={busy === "del"}
              onClick={async () => {
                setBusy("del");
                try {
                  await api("/api/account", { method: "DELETE", body: { confirm } });
                  window.location.href = "/";
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : "Couldn't delete the account.");
                  setBusy(null);
                }
              }}
            >
              Delete everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
