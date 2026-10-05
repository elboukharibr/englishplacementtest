import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody } from "@/lib/api";
import { ownedDeck } from "@/lib/data/access";
import { CARD_TYPES, DIFFICULTIES } from "@/lib/ai/schemas";
import { embedCards } from "@/lib/data/cards";

const Body = z.object({
  question: z.string().trim().min(1).max(600),
  answer: z.string().trim().min(1).max(800),
  cardType: z.enum(CARD_TYPES).default("basic"),
  difficulty: z.enum(DIFFICULTIES).default("intermediate"),
  topic: z.string().max(120).optional(),
});

export const POST = withUser<{ deckId: string }>(async (req, user, { deckId }) => {
  const deck = await ownedDeck(user.id, deckId);
  const b = await parseBody(req, Body);
  const card = await db.card.create({
    data: { deckId: deck.id, userId: user.id, question: b.question, answer: b.answer, cardType: b.cardType, difficulty: b.difficulty, topic: b.topic || null, origin: "manual", importance: 60 },
  });
  await embedCards(user.id, [card]);
  return ok({ card }, { status: 201 });
});
