import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody } from "@/lib/api";

export const GET = withUser(async (_req, user) => {
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return ok({ items, unread: items.filter((i) => !i.readAt).length });
});

const Body = z.object({ ids: z.array(z.string()).optional() });
export const POST = withUser(async (req, user) => {
  const b = await parseBody(req, Body);
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(b.ids ? { id: { in: b.ids } } : {}) }, data: { readAt: new Date() } });
  return ok();
});
