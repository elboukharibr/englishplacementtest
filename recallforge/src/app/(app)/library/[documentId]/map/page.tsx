import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/billing/usage";
import { deckMastery } from "@/lib/srs/mastery";
import { conceptKey } from "@/lib/pipeline/importance";
import { normalizeText } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { KnowledgeMap, type MapEdge, type MapNode } from "@/components/app/knowledge-map";

export const metadata: Metadata = { title: "Knowledge map" };

export default async function MapPage({ params }: { params: Promise<{ documentId: string }> }) {
  const user = await requireOnboardedUser();
  const { documentId } = await params;
  const doc = await db.document.findFirst({ where: { id: documentId, userId: user.id }, select: { id: true, title: true, isSample: true } });
  if (!doc) notFound();
  const back = (
    <Link href={`/library/${doc.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
      <ArrowLeft className="size-4" /> {doc.title}
    </Link>
  );
  if (!doc.isSample && !hasFeature(user, "knowledgeMap")) {
    return (
      <div>
        {back}
        <EmptyState icon={Lock} title="Knowledge maps are part of Pro" description="See how the concepts in your document connect, with mastery for each one." action={<Button asChild><Link href="/pricing">See Pro</Link></Button>} />
      </div>
    );
  }
  const concepts = await db.concept.findMany({ where: { documentId }, orderBy: { importance: "desc" }, take: 40 });
  const cards = await db.card.findMany({
    where: { userId: user.id, deck: { documentId } },
    select: { id: true, deckId: true, question: true, topic: true, conceptId: true, state: true, stability: true, lastReview: true, lapses: true, reps: true },
  });
  const keyToId = new Map(concepts.map((c) => [conceptKey(c.name), c.id]));
  const nodes: MapNode[] = concepts.map((c) => {
    const mine = cards.filter((k) => k.conceptId === c.id || (k.topic && normalizeText(k.topic) === normalizeText(c.name)));
    const reviewed = mine.filter((k) => k.state !== "NEW");
    return {
      id: c.id,
      name: c.name,
      kind: c.kind,
      summary: c.summary,
      importance: c.importance,
      sectionId: c.sectionId,
      page: c.pageStart,
      mastery: reviewed.length ? deckMastery(mine).mastery : null,
      cards: mine.map((k) => ({ id: k.id, deckId: k.deckId, question: k.question })),
    };
  });
  const seen = new Set<string>();
  const edges: MapEdge[] = [];
  for (const c of concepts)
    for (const r of c.related) {
      const to = keyToId.get(conceptKey(r));
      if (!to || to === c.id) continue;
      const k = [c.id, to].sort().join("|");
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push({ from: c.id, to });
    }
  return (
    <div>
      {back}
      <PageHeader title="Knowledge map" description={`${nodes.length} most important concepts and how the document connects them.`} />
      {nodes.length ? <KnowledgeMap nodes={nodes} edges={edges} /> : <EmptyState title="No concepts were extracted from this document." />}
    </div>
  );
}
