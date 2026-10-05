import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";

const Body = z.object({ targetId: z.string(), sourceIds: z.array(z.string()).min(1).max(20) });

/** Moves all cards (with their review history) from source decks into the target, then deletes the sources. */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, Body);
  const ids = [body.targetId, ...body.sourceIds.filter((i) => i !== body.targetId)];
  const decks = await db.deck.findMany({ where: { id: { in: ids }, userId: user.id } });
  if (decks.length !== ids.length) return jsonError("One or more decks were not found.", 404);
  await db.$transaction([
    db.card.updateMany({ where: { deckId: { in: body.sourceIds }, userId: user.id }, data: { deckId: body.targetId } }),
    db.studySession.updateMany({ where: { deckId: { in: body.sourceIds }, userId: user.id }, data: { deckId: body.targetId } }),
    db.examAttempt.updateMany({ where: { deckId: { in: body.sourceIds }, userId: user.id }, data: { deckId: body.targetId } }),
    db.deck.deleteMany({ where: { id: { in: body.sourceIds.filter((i) => i !== body.targetId) }, userId: user.id } }),
  ]);
  return ok({ id: body.targetId });
});
