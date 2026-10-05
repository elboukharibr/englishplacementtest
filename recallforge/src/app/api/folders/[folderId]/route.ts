import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";

const Patch = z.object({ name: z.string().trim().min(1).max(80).optional(), parentId: z.string().nullable().optional() });

export const PATCH = withUser<{ folderId: string }>(async (req, user, { folderId }) => {
  const f = await db.folder.findFirst({ where: { id: folderId, userId: user.id } });
  if (!f) return jsonError("Folder not found.", 404);
  const b = await parseBody(req, Patch);
  if (b.parentId === folderId) return jsonError("A folder can't contain itself.", 400);
  if (b.parentId) {
    // Prevent cycles: walk up from the new parent.
    let cur = await db.folder.findFirst({ where: { id: b.parentId, userId: user.id } });
    if (!cur) return jsonError("Parent folder not found.", 404);
    while (cur?.parentId) {
      if (cur.parentId === folderId) return jsonError("That would create a loop of folders.", 400);
      cur = await db.folder.findFirst({ where: { id: cur.parentId, userId: user.id } });
    }
  }
  await db.folder.update({ where: { id: folderId }, data: b });
  return ok();
});

/** Deleting a folder keeps its decks (they move to the top level). Subfolders are removed. */
export const DELETE = withUser<{ folderId: string }>(async (_req, user, { folderId }) => {
  const f = await db.folder.findFirst({ where: { id: folderId, userId: user.id } });
  if (!f) return jsonError("Folder not found.", 404);
  const all = await db.folder.findMany({ where: { userId: user.id }, select: { id: true, parentId: true } });
  const ids = new Set([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of all) {
      if (x.parentId && ids.has(x.parentId) && !ids.has(x.id)) {
        ids.add(x.id);
        grew = true;
      }
    }
  }
  await db.deck.updateMany({ where: { folderId: { in: [...ids] }, userId: user.id }, data: { folderId: null } });
  await db.folder.delete({ where: { id: folderId } });
  return ok();
});
