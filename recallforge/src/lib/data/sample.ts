import { db, toVectorLiteral } from "@/lib/db";
import { getEmbedder } from "@/lib/ai/embeddings";
import { estimateTokens } from "@/lib/utils";
import { MEDIA_STUDIES, type SampleSubject } from "./sample-content";

/** Creates a document + deck from bundled sample content. Used for onboarding and dev seeding. */
export async function createSubjectFor(userId: string, s: SampleSubject, opts: { isSample: boolean }) {
  const words = s.sections.reduce((n, x) => n + x.text.split(/\s+/).length, 0);
  const doc = await db.document.create({
    data: {
      userId,
      title: s.documentTitle,
      filename: `${s.key}.txt`,
      fileType: "txt",
      mimeType: "text/plain",
      status: "READY",
      stage: "Ready",
      progress: 100,
      pageCount: s.sections.length,
      wordCount: words,
      subject: s.subject,
      isSample: opts.isSample,
      processedAt: new Date(),
      analysis: {
        pages: s.sections.length,
        pagesEstimated: false,
        words,
        readingMinutes: Math.max(1, Math.round(words / 200)),
        sections: s.sections.length,
        concepts: s.concepts.length,
        definitions: s.concepts.filter((c) => c.kind === "definition").length,
        scholars: s.concepts.filter((c) => c.kind === "scholar").length,
        theories: s.concepts.filter((c) => c.kind === "theory").length,
        processes: s.concepts.filter((c) => ["process", "mechanism", "method"].includes(c.kind)).length,
        relationships: s.concepts.reduce((n, c) => n + c.related.length, 0),
        examTopics: s.concepts.filter((c) => c.importance >= 75).length,
        recommendedCards: s.cards.length,
        manualPrepMinutes: Math.round(s.sections.length * 1.5 + s.cards.length * 2.5),
        aiPrepSeconds: 0,
        topConcepts: s.concepts.map((c) => ({ name: c.name, kind: c.kind, importance: c.importance })),
        kindCounts: {},
      },
    },
  });
  const sections = [];
  for (let i = 0; i < s.sections.length; i++) {
    const sec = s.sections[i];
    sections.push(
      await db.documentSection.create({
        data: {
          documentId: doc.id,
          order: i,
          heading: sec.heading,
          path: sec.heading,
          text: sec.text,
          pageOffsets: [{ page: sec.page, offset: 0 }],
          pageStart: sec.page,
          pageEnd: sec.page,
          tokenCount: estimateTokens(sec.text),
        },
      }),
    );
  }
  const concepts = [];
  for (const c of s.concepts) {
    concepts.push(
      await db.concept.create({
        data: {
          documentId: doc.id,
          sectionId: sections[c.section].id,
          name: c.name,
          normalized: c.name.toLowerCase(),
          kind: c.kind,
          summary: c.summary,
          importance: c.importance,
          related: c.related,
          examRelevant: c.importance >= 75,
          pageStart: s.sections[c.section].page,
        },
      }),
    );
  }
  const deck = await db.deck.create({
    data: {
      userId,
      documentId: doc.id,
      name: s.deckName,
      subject: s.subject,
      isSample: opts.isSample,
      status: "READY",
      description: opts.isSample ? "A small sample deck so you can try studying before uploading your own material." : "Demo content for development.",
      tags: opts.isSample ? ["sample"] : ["demo"],
    },
  });
  const cards = [];
  for (const c of s.cards) {
    const section = sections[c.section];
    const offset = section.text.indexOf(c.quote);
    if (offset < 0) throw new Error(`Sample quote not found in section: ${c.quote}`);
    cards.push(
      await db.card.create({
        data: {
          deckId: deck.id,
          userId,
          conceptId: concepts.find((x) => x.name === c.topic)?.id ?? null,
          question: c.q,
          answer: c.a,
          cardType: c.type,
          topic: c.topic,
          origin: "sample",
          sourceSectionId: section.id,
          sourceQuote: c.quote,
          sourcePage: s.sections[c.section].page,
          sourceHeading: section.heading,
          confidence: 0.95,
          confidenceLabel: "high",
          importance: 70,
        },
      }),
    );
  }
  const embedder = getEmbedder();
  const sv = await embedder.embed(sections.map((x) => x.text), { userId });
  for (let i = 0; i < sections.length; i++) await db.$executeRawUnsafe(`UPDATE "DocumentSection" SET "embedding" = $1::vector WHERE "id" = $2`, toVectorLiteral(sv[i]), sections[i].id);
  const cv = await embedder.embed(cards.map((x) => `${x.question} ${x.answer}`), { userId });
  for (let i = 0; i < cards.length; i++) await db.$executeRawUnsafe(`UPDATE "Card" SET "embedding" = $1::vector WHERE "id" = $2`, toVectorLiteral(cv[i]), cards[i].id);
  return { document: doc, deck };
}

export async function ensureSampleDeck(userId: string) {
  const existing = await db.deck.findFirst({ where: { userId, isSample: true } });
  if (existing) return existing;
  const { deck } = await createSubjectFor(userId, MEDIA_STUDIES, { isSample: true });
  return deck;
}
