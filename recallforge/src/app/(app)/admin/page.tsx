import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboardedUser, isAdmin } from "@/lib/auth/session";
import { adminMetrics, eventCounts } from "@/lib/data/admin";
import { aiStatus } from "@/lib/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/misc";
import { pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function AdminPage() {
  const user = await requireOnboardedUser();
  if (!isAdmin(user)) notFound();
  const [m, events] = await Promise.all([adminMetrics(), eventCounts()]);
  const ai = aiStatus();
  return (
    <div className="space-y-8">
      <PageHeader title="Admin" description={`AI provider: ${ai.provider}${ai.configured ? "" : " (not configured)"} · revenue estimated from active subscriptions at list price`} />
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">North star</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Weekly active learners (completed a review)" value={m.northStar} />
          <Stat label="Reviews / learner / week" value={m.reviewsPerLearnerWeek.toFixed(1)} />
          <Stat label="Documents → deck (30d)" value={pct(m.docToDeckConversion)} />
          <Stat label="Generated cards studied (30d)" value={pct(m.generatedCardsStudied)} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Revenue</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Users" value={m.users} />
          <Stat label="Active subscribers" value={m.activeSubscribers} />
          <Stat label="MRR" value={usd(m.mrr)} />
          <Stat label="ARR" value={usd(m.arr)} />
          <Stat label="Free → Pro" value={pct(m.conversion)} hint={`Churn (30d): ${pct(m.churn30)}`} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Unit economics (last 30 days)</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="AI cost" value={usd(m.aiCost30)} hint={`${m.aiCalls30} calls · ${(m.tokens30 / 1e6).toFixed(2)}M tokens`} />
          <Stat label="Storage cost (est.)" value={usd(m.storageCost)} hint={`${m.storageGb.toFixed(2)} GB stored`} />
          <Stat label="Infrastructure (env)" value={usd(m.infraCost)} />
          <Stat label="Contribution margin" value={usd(m.contributionMargin)} tone={m.contributionMargin >= 0 ? "success" : "danger"} hint="MRR − AI − storage − infra" />
          <Stat label="AI cost / active learner" value={usd(m.avgAiCostPerActiveLearner)} />
          <Stat label="Revenue / user (ARPU)" value={usd(m.arpu)} />
          <Stat label="Documents processed" value={m.documents30} />
          <Stat label="Cards generated" value={m.cardsGenerated30.toLocaleString()} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Engagement</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Study sessions (30d)" value={m.sessions30} />
          <Stat label="7-day retention" value={m.retention7 ? pct(m.retention7.rate) : "–"} hint={m.retention7 ? `cohort of ${m.retention7.cohort}` : "no cohort yet"} />
          <Stat label="30-day retention" value={m.retention30 ? pct(m.retention30.rate) : "–"} hint={m.retention30 ? `cohort of ${m.retention30.cohort}` : "no cohort yet"} />
          <Stat label="Failed jobs (30d)" value={m.failed30} hint={`${m.queued} queued/running now`} tone={m.failed30 ? "warning" : "neutral"} />
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent failed jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {m.failedJobs.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {m.failedJobs.map((j) => (
                  <li key={j.id} className="py-2">
                    <p className="font-medium">
                      {j.type} <span className="font-normal text-muted">· {j.updatedAt.toLocaleString()} · {j.attempts} attempts</span>
                    </p>
                    <p className="line-clamp-2 text-xs text-muted">{j.lastError}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Product events (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {events.map((e) => (
                <li key={e.name} className="flex justify-between py-1.5">
                  <code className="text-xs">{e.name}</code>
                  <span className="tabular-nums">{e.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
