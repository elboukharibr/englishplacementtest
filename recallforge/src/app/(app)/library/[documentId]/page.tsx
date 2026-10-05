import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Network, Sparkles } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getUsage } from "@/lib/billing/usage";
import { limitsFor } from "@/lib/billing/plans";
import type { DocumentAnalysis } from "@/lib/pipeline/process-document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, Badge, PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ProcessingStatus } from "@/components/app/processing-status";
import { GenerateForm } from "@/components/app/generate-form";
import { DocumentActions } from "@/components/app/document-actions";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Document" };

const GOAL_TO_STUDY: Record<string, string> = { exam: "exam_preparation", oral: "exam_preparation", understand: "deep_understanding", papers: "deep_understanding", retention: "long_term_mastery", memorize: "quick_revision" };

export default async function DocumentPage({ params }: { params: Promise<{ documentId: string }> }) {
  const user = await requireOnboardedUser();
  const { documentId } = await params;
  const doc = await db.document.findFirst({
    where: { id: documentId, userId: user.id },
    include: { decks: { select: { id: true, name: true, status: true, _count: { select: { cards: true } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!doc) notFound();
  const analysis = doc.analysis as DocumentAnalysis | null;
  const limits = limitsFor(user.plan);
  const usage = await getUsage(user.id);
  const warnings = (doc.extractionWarnings as string[] | null) ?? [];
  const processing = doc.status !== "READY";
  const savedMinutes = analysis ? Math.max(0, analysis.manualPrepMinutes - analysis.aiPrepSeconds / 60) : 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/library" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Library
        </Link>
        <PageHeader
          title={doc.title}
          description={`${doc.fileType.toUpperCase()} · ${doc.filename}${doc.pageCount ? ` · ${doc.pageCount} pages${analysis?.pagesEstimated ? " (estimated)" : ""}` : ""}`}
          actions={<DocumentActions documentId={doc.id} title={doc.title} hasDecks={doc.decks.length > 0} />}
        />
      </div>

      {processing ? (
        <div className="mx-auto max-w-2xl">
          <ProcessingStatus documentId={doc.id} initial={{ status: doc.status, stage: doc.stage, progress: doc.progress, errorReason: doc.errorReason }} />
        </div>
      ) : (
        <>
          {analysis ? (
            <Card className="overflow-hidden">
              <div className="border-b border-border bg-primary-soft/60 px-6 py-5">
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="size-4" /> Document analysis
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  We analyzed your {analysis.pages}-page {analysis.pagesEstimated ? "document" : doc.fileType === "pptx" ? "slide deck" : "document"}.
                </h2>
              </div>
              <CardContent className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr]">
                <div>
                  <p className="mb-3 text-sm text-muted">We found:</p>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      ["Core concepts", analysis.concepts],
                      ["Definitions", analysis.definitions],
                      ["Key scholars", analysis.scholars],
                      ["Theories", analysis.theories],
                      ["Processes/frameworks", analysis.processes],
                      ["Potential exam topics", analysis.examTopics],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-xl border border-border p-3">
                        <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
                        <dt className="text-xs text-muted">{k}</dt>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-sm text-muted">Estimated reading time: {formatDuration(analysis.readingMinutes)} · {analysis.sections} sections · {analysis.words.toLocaleString()} words</p>
                </div>
                <div className="space-y-3 rounded-2xl bg-surface-2 p-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Estimated manual preparation</span>
                    <span className="font-medium">{formatDuration(analysis.manualPrepMinutes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">AI preparation time</span>
                    <span className="font-medium">{analysis.aiPrepSeconds < 60 ? `${analysis.aiPrepSeconds}s` : `${Math.floor(analysis.aiPrepSeconds / 60)}m ${analysis.aiPrepSeconds % 60}s`}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <span className="font-medium">Estimated time saved</span>
                    <span className="font-semibold text-success">{formatDuration(savedMinutes)}</span>
                  </div>
                  <p className="text-xs text-muted">Manual estimate assumes ~1.5 min per page to identify key material and ~2.5 min to write each card for a deck of {analysis.recommendedCards}.</p>
                </div>
              </CardContent>
              {analysis.topConcepts.length > 0 && (
                <div className="border-t border-border px-6 py-4">
                  <p className="mb-2 text-xs text-muted">Highest-importance concepts</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.topConcepts.map((c) => (
                      <Badge key={c.name} tone="neutral" className="text-[13px]">
                        {c.name} <span className="text-muted/80">· {c.importance}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Alert tone="info">The analysis for this document was removed. You can still generate decks from it.</Alert>
          )}

          {warnings.length > 0 && (
            <Alert tone="warning" title="Notes from text extraction">
              <ul className="list-disc space-y-1 pl-4">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}

          {doc.decks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Decks from this document</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {doc.decks.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                      <Link href={`/decks/${d.id}`} className="font-medium hover:text-primary">
                        {d.name}
                      </Link>
                      <span className="text-muted">{d.status === "READY" ? `${d._count.cards} cards` : d.status.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="font-serif text-xl">{doc.decks.length ? "Generate another deck" : "Generate my study deck"}</CardTitle>
              {analysis && analysis.concepts > 0 && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/library/${doc.id}/map`}>
                    <Network /> Knowledge map
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <GenerateForm
                documentId={doc.id}
                defaultName={doc.decks.length ? `${doc.title} (${doc.decks.length + 1})` : doc.title}
                recommended={analysis?.recommendedCards ?? 40}
                defaultSize={user.defaultDeckSize}
                defaultDifficulty={user.defaultDifficulty}
                maxCards={limits.maxCardsPerDeck}
                remainingCards={Math.max(0, limits.cardsPerPeriod - usage.cardsGenerated)}
                plan={user.plan}
                studyGoalDefault={GOAL_TO_STUDY[user.primaryGoal ?? ""] ?? "exam_preparation"}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
