import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Lock } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { analyticsOverview } from "@/lib/data/analytics";
import { hasFeature } from "@/lib/billing/usage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress, Stat } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { RecallChart, ReviewsChart } from "@/components/app/charts";
import { formatDuration, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await requireOnboardedUser();
  const a = await analyticsOverview(user.id, user.timezone);
  const advanced = hasFeature(user, "advancedAnalytics");
  if (a.longTerm.totalReviews === 0) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <EmptyState icon={BarChart3} title="No study data yet" description="Review some cards from your own decks and your progress will appear here. Sample-deck reviews aren't counted." action={<Button asChild><Link href="/review">Start reviewing</Link></Button>} />
      </div>
    );
  }
  const delta = a.week.recall != null && a.week.lastWeekRecall != null ? a.week.recall - a.week.lastWeekRecall : null;
  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" description="Recall rate = share of reviews of previously seen cards you remembered (Hard, Good or Easy)." />
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Today</h2>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Cards reviewed" value={a.today.reviewed} />
          <Stat label="Minutes studied" value={a.today.minutes} />
          <Stat label="Accuracy" value={pct(a.today.accuracy)} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">This week</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Study time" value={formatDuration(a.week.minutes)} />
          <Stat label="Reviews" value={a.week.reviews} />
          <Stat label="Cards matured" value={a.week.cardsMastered} hint="Reached a 21-day stability" />
          <Stat label="Recall rate" value={pct(a.week.recall)} hint={delta != null ? `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)} pts vs last week` : undefined} />
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reviews per day</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewsChart data={a.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recall rate</CardTitle>
          </CardHeader>
          <CardContent>
            {advanced ? (
              <RecallChart data={a.series} />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-3 text-center text-sm text-muted">
                <Lock className="size-5" /> Recall trends are part of Pro.
                <Button asChild size="sm" variant="secondary">
                  <Link href="/pricing">See Pro</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Long term</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Total study time" value={formatDuration(a.longTerm.totalMinutes)} />
          <Stat label="Total reviews" value={a.longTerm.totalReviews.toLocaleString()} />
          <Stat label="Average recall" value={pct(a.longTerm.averageRecall)} />
          <Stat label="Retention estimate" value={pct(a.longTerm.retentionEstimate)} hint="Predicted recall right now" />
          <Stat label="Study streak" value={`${a.longTerm.streak} days`} />
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Card maturity</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-5 gap-2 text-center">
              {[["New", a.breakdown.new], ["Learning", a.breakdown.learning], ["Young", a.breakdown.young], ["Mature", a.breakdown.mature], ["Weak", a.breakdown.weak]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-surface-2 p-2">
                  <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                  <dt className="text-[11px] text-muted">{k}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">Mature = stability of 21+ days. Weak = forgotten twice or predicted recall under 70%.</p>
          </CardContent>
        </Card>
        <TopicList title="Strongest topics" items={a.strongest} tone="success" />
        <TopicList title="Weakest topics" items={a.weakest} tone="danger" />
      </div>
    </div>
  );
}

function TopicList({ title, items, tone }: { title: string; items: { topic: string; mastery: number; cards: number }[]; tone: "success" | "danger" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Not enough reviews per topic yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((t) => (
              <li key={t.topic} className="text-sm">
                <div className="mb-1 flex justify-between gap-3">
                  <span className="truncate">{t.topic}</span>
                  <span className="tabular-nums text-muted">{pct(t.mastery)}</span>
                </div>
                <Progress value={t.mastery * 100} tone={tone} label={`${t.topic} mastery`} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
