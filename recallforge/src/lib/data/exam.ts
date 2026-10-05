import { db } from "@/lib/db";
import type { SourceChunk } from "@/lib/ai/types";
import { retrieveSections } from "./search";

/** Source chunks for exam questions: the document's most important sections, or the cards themselves for imported decks. */
export async function examSources(userId: string, deck: { id: string; documentId: string | null }, limit = 6): Promise<{ chunks: SourceChunk[]; concepts: { name: string; kind: string; summary: string; importance: number; chunkId: string | null }[] }> {
  if (deck.documentId) {
    const concepts = await db.concept.findMany({ where: { documentId: deck.documentId }, orderBy: { importance: "desc" }, take: 30 });
    // Weight sections by important concepts, then sample across the document for variety.
    const weights = new Map<string, number>();
    for (const c of concepts) if (c.sectionId) weights.set(c.sectionId, (weights.get(c.sectionId) ?? 0) + c.importance);
    const sectionIds = [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const shuffled = sectionIds.slice(0, limit * 2).sort(() => Math.random() - 0.5).slice(0, limit);
    const sections = await db.documentSection.findMany({ where: { id: { in: shuffled.length ? shuffled : undefined }, documentId: deck.documentId, isReferences: false }, take: limit });
    return {
      chunks: sections.map((s) => ({ id: s.id, heading: s.path ?? s.heading, text: s.text, pageStart: s.pageStart })),
      concepts: concepts.filter((c) => c.sectionId && shuffled.includes(c.sectionId)).map((c) => ({ name: c.name, kind: c.kind, summary: c.summary, importance: c.importance, chunkId: c.sectionId })),
    };
  }
  const cards = await db.card.findMany({ where: { deckId: deck.id, userId }, orderBy: { importance: "desc" }, take: 40 });
  const text = cards.map((c) => `${c.question.replace(/\{\{(.+?)\}\}/g, "$1")} — ${c.answer}`).join("\n");
  return { chunks: [{ id: `deck-${deck.id}`, heading: "Deck cards", text }], concepts: [] };
}

export async function sourcesForAttempt(userId: string, attempt: { deckId: string; question: string; sourceSectionIds: string[] }) {
  const deck = await db.deck.findFirst({ where: { id: attempt.deckId, userId } });
  if (!deck) return [];
  const ids = attempt.sourceSectionIds.filter((i) => !i.startsWith("deck-"));
  let sections = ids.length ? await db.documentSection.findMany({ where: { id: { in: ids }, document: { userId } } }) : [];
  if (!sections.length && deck.documentId) {
    const r = await retrieveSections(userId, deck.documentId, attempt.question, 3);
    sections = await db.documentSection.findMany({ where: { id: { in: r.map((x) => x.id) } } });
  }
  if (sections.length) return sections.map((s) => ({ id: s.id, heading: s.path ?? s.heading, text: s.text, pageStart: s.pageStart }));
  return (await examSources(userId, deck)).chunks;
}
