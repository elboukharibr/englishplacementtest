import { db } from "@/lib/db";
import { withUser, ok } from "@/lib/api";
import { ownedDeck } from "@/lib/data/access";

/** Copies a deck's cards without their review history (fresh scheduling). */
export const POST = withUser<{ deckId: string }>(async (_req, user, { deckId }) => {
  const deck = await ownedDeck(user.id, deckId);
  const cards = await db.card.findMany({ where: { deckId } });
  const copy = await db.deck.create({
    data: {
      userId: user.id,
      documentId: deck.documentId,
      folderId: deck.folderId,
      name: `${deck.name} (copy)`.slice(0, 160),
      description: deck.description,
      subject: deck.subject,
      tags: deck.tags,
      difficulty: deck.difficulty,
      studyGoal: deck.studyGoal,
      status: "READY",
    },
  });
  await db.card.createMany({
    data: cards.map((c) => ({
      deckId: copy.id,
      userId: user.id,
      conceptId: c.conceptId,
      question: c.question,
      answer: c.answer,
      cardType: c.cardType,
      difficulty: c.difficulty,
      topic: c.topic,
      tags: c.tags,
      origin: c.origin,
      sourceSectionId: c.sourceSectionId,
      sourceQuote: c.sourceQuote,
      sourcePage: c.sourcePage,
      sourceHeading: c.sourceHeading,
      confidence: c.confidence,
      confidenceLabel: c.confidenceLabel,
      needsVerification: c.needsVerification,
      importance: c.importance,
    })),
  });
  return ok({ id: copy.id }, { status: 201 });
});
