// Global search: semantic (pgvector) over source passages and cards, plus keyword
// matching on concepts, cards and documents. Always scoped to the current user.
import { db, toVectorLiteral } from "@/lib/db";
import { getEmbedder } from "@/lib/ai/embeddings";

export type SearchResults = {
  documents: { id: string; title: string; fileType: string }[];
  decks: { id: string; name: string }[];
  concepts: { id: string; name: string; kind: string; summary: string; documentId: string; documentTitle: string }[];
  cards: { id: string; deckId: string; deckName: string; question: string; answer: string; score: number | null }[];
  passages: { id: string; documentId: string; documentTitle: string; heading: string | null; pageStart: number | null; snippet: string; score: number }[];
};

function snippet(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase().split(" ")[0] ?? "");
  const start = Math.max(0, i - 80);
  return (start > 0 ? "…" : "") + text.slice(start, start + 260).trim() + "…";
}

export async function search(userId: string, q: string): Promise<SearchResults> {
  const query = q.trim().slice(0, 200);
  if (query.length < 2) return { documents: [], decks: [], concepts: [], cards: [], passages: [] };
  const like = { contains: query, mode: "insensitive" as const };
  const [vec] = await getEmbedder().embed([query], { userId });
  const v = toVectorLiteral(vec);

  const [documents, decks, concepts, keywordCards, semanticCards, passages] = await Promise.all([
    db.document.findMany({ where: { userId, title: like }, select: { id: true, title: true, fileType: true }, take: 5 }),
    db.deck.findMany({ where: { userId, name: like }, select: { id: true, name: true }, take: 5 }),
    db.concept.findMany({
      where: { document: { userId }, OR: [{ name: like }, { summary: like }] },
      orderBy: { importance: "desc" },
      take: 8,
      select: { id: true, name: true, kind: true, summary: true, documentId: true, document: { select: { title: true } } },
    }),
    db.card.findMany({ where: { userId, OR: [{ question: like }, { answer: like }] }, take: 10, select: { id: true, deckId: true, question: true, answer: true, deck: { select: { name: true } } } }),
    db.$queryRawUnsafe<{ id: string; deckId: string; question: string; answer: string; deckName: string; score: number }[]>(
      `SELECT c."id", c."deckId", c."question", c."answer", d."name" AS "deckName", 1 - (c."embedding" <=> $1::vector) AS score
       FROM "Card" c JOIN "Deck" d ON d."id" = c."deckId"
       WHERE c."userId" = $2 AND c."embedding" IS NOT NULL
       ORDER BY c."embedding" <=> $1::vector LIMIT 10`,
      v,
      userId,
    ),
    db.$queryRawUnsafe<{ id: string; documentId: string; title: string; heading: string | null; pageStart: number | null; text: string; score: number }[]>(
      `SELECT s."id", s."documentId", d."title", s."heading", s."pageStart", s."text", 1 - (s."embedding" <=> $1::vector) AS score
       FROM "DocumentSection" s JOIN "Document" d ON d."id" = s."documentId"
       WHERE d."userId" = $2 AND s."embedding" IS NOT NULL
       ORDER BY s."embedding" <=> $1::vector LIMIT 6`,
      v,
      userId,
    ),
  ]);

  const cardMap = new Map<string, SearchResults["cards"][number]>();
  for (const c of keywordCards) cardMap.set(c.id, { id: c.id, deckId: c.deckId, deckName: c.deck.name, question: c.question, answer: c.answer, score: null });
  for (const c of semanticCards) if (c.score > 0.25 && !cardMap.has(c.id)) cardMap.set(c.id, { ...c, score: Number(c.score) });

  return {
    documents,
    decks,
    concepts: concepts.map((c) => ({ id: c.id, name: c.name, kind: c.kind, summary: c.summary, documentId: c.documentId, documentTitle: c.document.title })),
    cards: [...cardMap.values()].slice(0, 12),
    passages: passages
      .filter((p) => Number(p.score) > 0.15)
      .map((p) => ({ id: p.id, documentId: p.documentId, documentTitle: p.title, heading: p.heading, pageStart: p.pageStart, snippet: snippet(p.text, query), score: Number(p.score) })),
  };
}

/** Retrieval for the tutor and exam grading (RAG). */
export async function retrieveSections(userId: string, documentId: string, query: string, k = 5) {
  const [vec] = await getEmbedder().embed([query], { userId });
  return db.$queryRawUnsafe<{ id: string; heading: string | null; path: string | null; text: string; pageStart: number | null; score: number }[]>(
    `SELECT s."id", s."heading", s."path", s."text", s."pageStart", 1 - (s."embedding" <=> $1::vector) AS score
     FROM "DocumentSection" s JOIN "Document" d ON d."id" = s."documentId"
     WHERE d."userId" = $2 AND s."documentId" = $3 AND s."embedding" IS NOT NULL AND s."isReferences" = false
     ORDER BY s."embedding" <=> $1::vector LIMIT ${Math.min(10, Math.max(1, k))}`,
    toVectorLiteral(vec),
    userId,
    documentId,
  );
}
