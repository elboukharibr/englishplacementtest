import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";
import { embedCards } from "@/lib/data/cards";

const Body = z.object({ ids: z.array(z.string()).min(2).max(6), question: z.string().trim().min(1).max(600), answer: z.string().trim().min(1).max(800) });

/** Merges several cards into one (user supplies the merged wording); keeps the first card's source and history. */
export const POST = withUser(async (req, user) => {
  const b = await parseBody(req, Body);
  const cards = await db.card.findMany({ where: { id: { in: b.ids }, userId: user.id } });
  if (cards.length !== b.ids.length) return jsonError("Some cards were not found.", 404);
  if (new Set(cards.map((c) => c.deckId)).size > 1) return jsonError("Only cards from the same deck can be merged.", 400);
  const keep = cards.find((c) => c.id === b.ids[0])!;
  const updated = await db.card.update({ where: { id: keep.id }, data: { question: b.question, answer: b.answer, cardType: "basic", needsVerification: false } });
  await db.card.deleteMany({ where: { id: { in: b.ids.slice(1) }, userId: user.id } });
  await embedCards(user.id, [updated]);
  return ok({ card: updated });
});
