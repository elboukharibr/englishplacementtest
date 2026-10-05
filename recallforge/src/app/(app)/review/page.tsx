import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, RotateCcw, Target } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { reviewQueueSummary, weakTopics } from "@/lib/data/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireOnboardedUser();
  const { mode } = await searchParams;
  const [queue, weak] = await Promise.all([reviewQueueSummary(user.id), weakTopics(user.id, undefined, 8)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Today's review" description="Cards are scheduled by FSRS so you review each one just before you'd forget it." />
      {queue.total === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing is due right now."
          description="Come back later, or learn new cards from one of your decks."
          action={
            <Button asChild variant="secondary">
              <Link href="/decks">Browse decks</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted">Cards due</p>
              <p className="text-4xl font-semibold tabular-nums">{queue.total}</p>
              <p className="text-sm text-muted">Estimated duration: {queue.estimatedMinutes} minutes</p>
            </div>
            <Button asChild size="lg">
              <Link href="/study/all?mode=review">
                <RotateCcw /> Review all
              </Link>
            </Button>
          </CardContent>
          <div className="border-t border-border px-6 py-4">
            <p className="mb-2 text-sm font-medium">Review by deck</p>
            <ul className="divide-y divide-border">
              {queue.decks.map((d) => (
                <li key={d.deckId} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="truncate">{d.name}</span>
                    {d.isSample && <Badge tone="primary">Sample</Badge>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-muted">{d.due}</span>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/study/${d.deckId}?mode=review`}>Review</Link>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
      <Card className={mode === "weak" ? "ring-2 ring-primary" : undefined}>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-danger" /> Weak topics
          </CardTitle>
          {weak.length > 0 && (
            <Button asChild size="sm">
              <Link href="/study/all?mode=weak">Practice weak topics</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {weak.length === 0 ? (
            <p className="text-sm text-muted">No weak topics detected yet. Topics appear here when you repeatedly forget their cards or their predicted recall drops below 70%.</p>
          ) : (
            <ul className="space-y-3">
              {weak.map((w) => (
                <li key={`${w.deckId}-${w.topic}`}>
                  <Link href={`/study/${w.deckId}?mode=weak&topic=${encodeURIComponent(w.topic)}`} className="flex items-center gap-4 rounded-lg p-1 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{w.topic}</p>
                      <p className="truncate text-xs text-muted">
                        {w.deckName} · {w.cards} cards · {w.lapses} lapses
                      </p>
                    </div>
                    <div className="hidden w-32 sm:block">
                      <Progress value={w.mastery * 100} tone="danger" label={`${w.topic} mastery`} />
                    </div>
                    <span className="w-12 text-right text-sm tabular-nums">{pct(w.mastery)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
