import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Lock } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { buildStudyPlan } from "@/lib/data/studyplan";
import { hasFeature } from "@/lib/billing/usage";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, Progress, Stat } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ExamDateForm } from "@/components/app/exam-date-form";
import { pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Study plan" };

export default async function StudyPlanPage() {
  const user = await requireOnboardedUser();
  if (!hasFeature(user, "studyPlan")) {
    return (
      <div>
        <PageHeader title="Study plan" />
        <EmptyState icon={Lock} title="Study plans are part of Pro" description="Enter your exam date and get a daily workload that adapts when you miss a day." action={<Button asChild><Link href="/pricing">See Pro</Link></Button>} />
      </div>
    );
  }
  const plan = await buildStudyPlan(user, { horizonDays: 14 });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      <PageHeader title="Study plan" description="Recalculated from your real progress every time you open it. Missed days are spread over the next three days." actions={<ExamDateForm current={user.examDate?.toISOString().slice(0, 10) ?? ""} />} />
      {plan.daysToExam ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Exam in" value={`${plan.daysToExam} days`} />
          <Stat label="Current mastery" value={pct(plan.currentMastery)} hint="Suggested: 90%" />
          <Stat label="Cards requiring review" value={plan.cardsRequiringReview} />
          <Stat label="Estimated daily workload" value={`${plan.estimatedDailyWorkload} cards/day`} />
        </div>
      ) : (
        <Alert tone="info" title="No exam date set">
          Add your exam date to get a plan that finishes introducing new cards before a final review period. Below is your next two weeks based on current schedules.
        </Alert>
      )}
      {plan.daysToExam && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Mastery progress</span>
            <span>{pct(plan.currentMastery)} of 90%</span>
          </div>
          <Progress value={(plan.currentMastery / 0.9) * 100} tone="success" label="Mastery toward goal" />
        </div>
      )}
      {plan.overloaded && <Alert tone="warning" title="Heavy schedule">The plan averages more than your daily goal ({user.dailyReviewGoal}). Consider raising the goal in Settings or archiving lower-priority decks.</Alert>}
      {plan.overdue > 0 && <Alert tone="info">{plan.overdue} overdue cards from missed sessions are spread across the next three days.</Alert>}
      {plan.days.every((d) => d.total === 0) ? (
        <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Generate a deck to start building a plan." />
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plan.days.map((d) => (
            <li key={d.date}>
              <Card className={d.date === today ? "ring-2 ring-primary" : undefined}>
                <CardContent className="p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">{d.date === today ? "Today" : new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                    <p className="text-lg font-semibold tabular-nums">{d.total}</p>
                  </div>
                  <p className="text-xs text-muted">
                    {d.reviews} reviews · {d.newCards} new
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {d.decks.slice(0, 3).map((x) => (
                      <li key={x.deckId} className="flex justify-between gap-2">
                        <span className="truncate text-fg/80">{x.name}</span>
                        <span className="tabular-nums text-muted">{x.count}</span>
                      </li>
                    ))}
                    {d.decks.length > 3 && <li className="text-xs text-muted">+{d.decks.length - 3} more decks</li>}
                  </ul>
                  {d.date === today && d.total > 0 && (
                    <Button asChild size="sm" className="mt-3 w-full">
                      <Link href="/study/all?mode=study">Start today&apos;s session</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
