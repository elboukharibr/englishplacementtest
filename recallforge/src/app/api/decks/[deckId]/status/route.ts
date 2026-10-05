import { withUser, ok } from "@/lib/api";
import { ownedDeck } from "@/lib/data/access";

export const GET = withUser<{ deckId: string }>(async (_req, user, { deckId }) => {
  const d = await ownedDeck(user.id, deckId);
  return ok({ id: d.id, status: d.status, progress: d.progress, statusMessage: d.statusMessage, report: d.generationReport });
});
