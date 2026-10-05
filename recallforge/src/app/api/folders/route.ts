import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody, jsonError } from "@/lib/api";

const Body = z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().nullable().optional() });

export const POST = withUser(async (req, user) => {
  const b = await parseBody(req, Body);
  if (b.parentId && !(await db.folder.findFirst({ where: { id: b.parentId, userId: user.id } }))) return jsonError("Parent folder not found.", 404);
  if ((await db.folder.count({ where: { userId: user.id } })) >= 200) return jsonError("You've reached the folder limit (200).", 400);
  const folder = await db.folder.create({ data: { userId: user.id, name: b.name, parentId: b.parentId ?? null } });
  return ok({ folder }, { status: 201 });
});
