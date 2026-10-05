import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";
import { ownedDeck } from "@/lib/data/access";

const Patch = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(1000).nullable().optional(),
  subject: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
});

export const PATCH = withUser<{ deckId: string }>(async (req, user, { deckId }) => {
  await ownedDeck(user.id, deckId);
  const body = await parseBody(req, Patch);
  if (body.folderId) {
    const f = await db.folder.findFirst({ where: { id: body.folderId, userId: user.id } });
    if (!f) return jsonError("Folder not found.", 404);
  }
  const deck = await db.deck.update({ where: { id: deckId }, data: body });
  return ok({ id: deck.id });
});

export const DELETE = withUser<{ deckId: string }>(async (_req, user, { deckId }) => {
  await ownedDeck(user.id, deckId);
  await db.deck.delete({ where: { id: deckId } });
  return ok();
});
