import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardPaste, Clock, FileText, Flame, Layers, RotateCcw, Target, TrendingUp, Upload } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { dashboardStats, improvementMoment, reviewQueueSummary, weakTopics } from "@/lib/data/analytics";
import { listDeckSummaries } from "@/lib/data/decks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress, Stat } from "@/components/ui/misc";
import { DeckCard } from "@/components/app/deck-card";
import { formatDuration, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const [stats, queue, decks, weak, improvement] = await Promise.all([
    dashboardStats(user.id, user.timezone),
    reviewQueueSummary(user.id),
    listDeckSummaries(user.id, { take: 6 }),
    weakTopics(user.id, undefined, 3),
    improvementMoment(user.id),
  ]);
  const daysToExam = user.examDate ? Math.ceil((user.examDate.getTime() - Date.now()) / 86400000) : null;
  const hasOwnDecks = decks.some((d) => !d.isSample);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting}${user.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={queue.total > 0 ? `${queue.total} card${queue.total === 1 ? " is" : "s are"} ready for review.` : "Nothing is due right now."}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/upload?tab=paste">
                <ClipboardPaste /> Paste text
              </Link>
            </Button>
            <Button asChild>
              <Link href="/upload">
                <Upload /> Upload study material
              </Link>
            </Button>
          </>
        }
      />

      <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Documents" value={stats.documents} icon={FileText} />
        <Stat label="Cards" value={stats.cards.toLocaleString()} icon={Layers} />
        <Stat label="Due today" value={stats.dueToday} icon={RotateCcw} tone={stats.dueToday ? "warning" : "neutral"} />
        <Stat label="Mastery" value={stats.mastery == null ? "–" : pct(stats.mastery)} icon={Target} tone="success" hint={stats.mastery == null ? "Review some cards to start measuring" : undefined} />
        <Stat label="Study streak" value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`} icon={Flame} tone={stats.streak ? "primary" : "neutral"} />
      </section>

      {improvement && (
        <Card className="border-success/30 bg-success-soft">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="size-6 text-success" />
              <div>
                <p className="font-serif text-lg font-semibold">You&apos;re getting stronger.</p>
                <p className="text-sm text-fg/80">
                  Recall rate {pct(improvement.before)} last week → {pct(improvement.after)} in the last two days.
                  {improvement.strongest && ` Biggest gain: ${improvement.strongest.topic} (+${Math.round(improvement.strongest.delta * 100)}%).`}
                </p>
              </div>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/analytics">See analytics</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today&apos;s review</CardTitle>
          </CardHeader>
          <CardContent>
            {queue.total > 0 ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-3xl font-semibold tabular-nums">{queue.total}</p>
                  <p className="text-sm text-muted">cards ready · about {queue.estimatedMinutes} min</p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {queue.decks.slice(0, 4).map((d) => (
                      <li key={d.deckId} className="flex justify-between gap-6">
                        <span className="truncate">{d.name}</span>
                        <span className="tabular-nums text-muted">{d.due}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button asChild size="lg">
                  <Link href="/review">Start review</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">
                You&apos;re all caught up. {stats.newAvailable > 0 ? `${stats.newAvailable} new cards are waiting whenever you want to learn more.` : "Upload material to create more cards."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-success" /> Time saved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatDuration(stats.minutesSavedThisPeriod)}</p>
              <p className="mt-1 text-xs text-muted">Estimated this month, at ~2.5 min per hand-written card. {stats.minutesSavedTotal > stats.minutesSavedThisPeriod && `${formatDuration(stats.minutesSavedTotal)} in total.`}</p>
            </CardContent>
          </Card>
          {daysToExam != null && daysToExam > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" /> Exam in {daysToExam} day{daysToExam === 1 ? "" : "s"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>Current mastery</span>
                    <span>{stats.mastery == null ? "–" : pct(stats.mastery)} / 90% suggested</span>
                  </div>
                  <Progress value={(stats.mastery ?? 0) * 100} tone="success" label="Mastery towards exam goal" />
                </div>
                <Button asChild variant="secondary" size="sm" className="w-full">
                  <Link href="/study-plan">Build my study plan</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Recent decks</h2>
          <Link href="/decks" className="text-sm text-primary hover:underline">
            All decks
          </Link>
        </div>
        {!hasOwnDecks && (
          <EmptyState
            icon={Upload}
            className="mb-6"
            title="Your study library is empty."
            description="Upload a textbook chapter, paper, or notes and we'll turn it into a study deck. Meanwhile, try the sample deck below."
            action={
              <Button asChild>
                <Link href="/upload">Upload material</Link>
              </Button>
            }
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <DeckCard key={d.id} deck={d} />
          ))}
        </div>
      </section>

      {weak.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Weak topics</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {weak.map((w) => (
                <li key={`${w.deckId}-${w.topic}`} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{w.topic}</p>
                    <p className="truncate text-xs text-muted">{w.deckName}</p>
                  </div>
                  <div className="w-32">
                    <Progress value={w.mastery * 100} tone="danger" label={`${w.topic} mastery`} />
                  </div>
                  <span className="w-10 text-right text-sm tabular-nums">{pct(w.mastery)}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/review?mode=weak">Practice weak topics</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
