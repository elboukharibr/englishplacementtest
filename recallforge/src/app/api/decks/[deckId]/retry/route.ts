import { db } from "@/lib/db";
import { withUser, ok, jsonError } from "@/lib/api";
import { ownedDeck } from "@/lib/data/access";
import { enqueue } from "@/lib/jobs/queue";

export const POST = withUser<{ deckId: string }>(async (_req, user, { deckId }) => {
  const deck = await ownedDeck(user.id, deckId);
  if (deck.status !== "FAILED") return jsonError("Only failed decks can be retried.", 409);
  await db.deck.update({ where: { id: deck.id }, data: { status: "GENERATING", progress: 2, statusMessage: "Queued…" } });
  await enqueue("generate_deck", { deckId: deck.id }, { userId: user.id });
  return ok();
});
