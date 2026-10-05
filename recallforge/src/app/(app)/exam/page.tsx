import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Lock, Mic } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/billing/usage";
import { Button } from "@/components/ui/button";
import { Alert, Badge, EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Exam Mode" };

export default async function ExamIndex() {
  const user = await requireOnboardedUser();
  const decks = await db.deck.findMany({ where: { userId: user.id, archived: false, status: "READY" }, orderBy: [{ isSample: "asc" }, { updatedAt: "desc" }], select: { id: true, name: true, isSample: true, _count: { select: { cards: true } } } });
  const pro = hasFeature(user, "examMode");
  const recent = await db.examAttempt.findMany({ where: { userId: user.id, answeredAt: { not: null } }, orderBy: { answeredAt: "desc" }, take: 5, include: { deck: { select: { name: true } } } });
  return (
    <div className="space-y-6">
      <PageHeader title="Exam Mode" description="Open questions, graded answers. Practise explaining, comparing and applying — not just recognising." />
      {!pro && (
        <Alert tone="info" title="Exam mode is part of Pro" action={<Link href="/pricing" className="text-primary underline">See Pro</Link>}>
          You can try it on the sample deck for free.
        </Alert>
      )}
      {decks.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No decks yet" description="Generate a deck from a document first." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {decks.map((d) => {
            const allowed = pro || d.isSample;
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="text-xs text-muted">
                    {d._count.cards} cards {d.isSample && <Badge tone="primary">Sample</Badge>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild size="sm" variant={allowed ? "primary" : "secondary"}>
                    <Link href={allowed ? `/exam/${d.id}` : "/pricing"}>{allowed ? <GraduationCap /> : <Lock />} Written</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={allowed ? `/exam/${d.id}?mode=oral` : "/pricing"}>
                      <Mic /> Oral
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-lg font-semibold">Recent answers</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{a.question}</p>
                  <p className="text-xs text-muted">{a.deck.name} · {a.mode}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{a.total?.toFixed(1)}/10</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
