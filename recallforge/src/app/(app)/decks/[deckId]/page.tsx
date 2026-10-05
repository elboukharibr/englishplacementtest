import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap, MessagesSquare, Mic, Play, ShieldCheck } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deckWithCards } from "@/lib/data/decks";
import { weakTopics } from "@/lib/data/analytics";
import { deckMastery } from "@/lib/srs/mastery";
import { hasFeature } from "@/lib/billing/usage";
import type { GenerationReport } from "@/lib/pipeline/generate-deck";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, PageHeader, Progress } from "@/components/ui/misc";
import { DeckGenerating } from "@/components/app/deck-generating";
import { DeckEditor, TYPE_LABELS } from "@/components/app/deck-editor";
import { DeckActions } from "@/components/app/deck-actions";
import { pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Deck" };

export default async function DeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  const user = await requireOnboardedUser();
  const { deckId } = await params;
  const deck = await deckWithCards(user.id, deckId);
  if (!deck) notFound();

  const header = (
    <div>
      <Link href="/decks" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Decks
      </Link>
      <PageHeader
        title={deck.name}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {deck.isSample && <Badge tone="primary">Sample deck</Badge>}
            {deck.archived && <Badge>Archived</Badge>}
            {deck.document ? (
              <Link href={`/library/${deck.document.id}`} className="hover:text-fg">
                From: {deck.document.title}
              </Link>
            ) : (
              <span>No source document</span>
            )}
          </span>
        }
      />
    </div>
  );

  if (deck.status !== "READY") {
    return (
      <div className="space-y-6">
        {header}
        <DeckGenerating deckId={deck.id} initial={{ status: deck.status, progress: deck.progress, statusMessage: deck.statusMessage }} />
      </div>
    );
  }

  const [folders, weak] = await Promise.all([db.folder.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }), weakTopics(user.id, deck.id, 5)]);
  const m = deckMastery(deck.cards.filter((c) => !c.suspended));
  const report = deck.generationReport as GenerationReport | null;
  const breakdown = deck.cards.reduce<Record<string, number>>((acc, c) => ((acc[c.cardType] = (acc[c.cardType] ?? 0) + 1), acc), {});
  const due = deck.cards.filter((c) => !c.suspended && c.due <= new Date()).length;
  const fresh = Date.now() - deck.createdAt.getTime() < 30 * 60_000 && m.new === m.total;
  const examAllowed = deck.isSample || hasFeature(user, "examMode");

  return (
    <div className="space-y-6">
      {header}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg">
          <Link href={`/study/${deck.id}`}>
            <Play /> {due > 0 ? `Study now (${due} due)` : "Study now"}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={examAllowed ? `/exam/${deck.id}` : "/pricing"}>
            <GraduationCap /> Exam mode{!examAllowed && " · Pro"}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={examAllowed ? `/exam/${deck.id}?mode=oral` : "/pricing"}>
            <Mic /> Oral exam{!examAllowed && " · Pro"}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={deck.isSample || hasFeature(user, "tutor") ? `/decks/${deck.id}/tutor` : "/pricing"}>
            <MessagesSquare /> Ask the tutor
          </Link>
        </Button>
        <div className="ml-auto flex gap-2">
          <DeckActions deck={{ id: deck.id, name: deck.name, favorite: deck.favorite, archived: deck.archived, folderId: deck.folderId, tags: deck.tags }} folders={folders} canApkg={hasFeature(user, "ankiExport")} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            {fresh ? (
              <>
                <p className="font-serif text-xl font-semibold">Your deck is ready</p>
                <p className="text-sm text-muted">{deck.cards.length} cards generated</p>
              </>
            ) : (
              <p className="font-serif text-xl font-semibold">{deck.cards.length} cards</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(breakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([t, n]) => (
                  <span key={t} className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
                    {TYPE_LABELS[t] ?? t} — <span className="font-medium">{n}</span>
                  </span>
                ))}
            </div>
            {report && (
              <p className="mt-4 flex items-start gap-2 text-xs text-muted">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                Quality checks: {report.candidates} candidates written; {report.rejectedUngrounded + report.rejectedUnsupported} rejected for weak source support; {report.removedDuplicates} duplicates removed; {report.flagged} flagged for your review.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted">Mastery</p>
              <p className="text-2xl font-semibold">{pct(m.mastery)}</p>
            </div>
            <Progress value={m.mastery * 100} tone="success" className="mt-2" label="Deck mastery" />
            <dl className="mt-4 grid grid-cols-5 gap-1 text-center text-xs">
              {[
                ["New", m.new],
                ["Learning", m.learning],
                ["Young", m.young],
                ["Mature", m.mature],
                ["Weak", m.weak],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dd className="text-base font-semibold tabular-nums">{v}</dd>
                  <dt className="text-muted">{k}</dt>
                </div>
              ))}
            </dl>
            {weak.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs text-muted">Weak topics</p>
                {weak.slice(0, 3).map((w) => (
                  <Link key={w.topic} href={`/study/${deck.id}?mode=weak&topic=${encodeURIComponent(w.topic)}`} className="flex justify-between py-0.5 text-sm hover:text-primary">
                    <span className="truncate">{w.topic}</span>
                    <span className="text-danger">{pct(w.mastery)}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DeckEditor
        deckId={deck.id}
        initialCards={deck.cards.map((c) => ({
          id: c.id,
          question: c.question,
          answer: c.answer,
          cardType: c.cardType,
          difficulty: c.difficulty,
          topic: c.topic,
          sourceSectionId: c.sourceSectionId,
          sourceQuote: c.sourceQuote,
          sourcePage: c.sourcePage,
          sourceHeading: c.sourceHeading,
          confidenceLabel: c.confidenceLabel,
          needsVerification: c.needsVerification,
          suspended: c.suspended,
          origin: c.origin,
          state: c.state,
        }))}
      />
    </div>
  );
}
