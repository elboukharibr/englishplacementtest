// Every read/write of user content goes through these helpers, which scope by userId.
// A user can never load another user's documents, decks, cards or sections.
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export async function ownedDeck(userId: string, deckId: string) {
  const deck = await db.deck.findFirst({ where: { id: deckId, userId } });
  if (!deck) throw new NotFoundError("Deck");
  return deck;
}

export async function ownedDocument(userId: string, documentId: string) {
  const doc = await db.document.findFirst({ where: { id: documentId, userId } });
  if (!doc) throw new NotFoundError("Document");
  return doc;
}

export async function ownedCard(userId: string, cardId: string) {
  const card = await db.card.findFirst({ where: { id: cardId, userId } });
  if (!card) throw new NotFoundError("Card");
  return card;
}

export async function ownedSection(userId: string, sectionId: string) {
  const section = await db.documentSection.findFirst({ where: { id: sectionId, document: { userId } } });
  if (!section) throw new NotFoundError("Source passage");
  return section;
}
