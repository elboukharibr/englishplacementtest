import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody } from "@/lib/api";
import { ownedDocument } from "@/lib/data/access";
import { storage } from "@/lib/storage";

const Patch = z.object({ title: z.string().trim().min(1).max(200).optional(), subject: z.string().max(80).nullable().optional(), course: z.string().max(80).nullable().optional() });

export const PATCH = withUser<{ documentId: string }>(async (req, user, { documentId }) => {
  await ownedDocument(user.id, documentId);
  const body = await parseBody(req, Patch);
  await db.document.update({ where: { id: documentId }, data: body });
  return ok();
});

/** Deletes the file, extracted text, embeddings and concepts. Decks made from it are kept unless ?decks=delete. */
export const DELETE = withUser<{ documentId: string }>(async (req, user, { documentId }) => {
  const doc = await ownedDocument(user.id, documentId);
  if (req.nextUrl.searchParams.get("decks") === "delete") await db.deck.deleteMany({ where: { documentId, userId: user.id } });
  if (doc.storageKey) await storage().delete(doc.storageKey).catch((e) => console.error("[delete] storage", e));
  await db.document.delete({ where: { id: doc.id } });
  return ok();
});
