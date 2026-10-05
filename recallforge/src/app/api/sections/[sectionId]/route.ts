import { withUser, ok } from "@/lib/api";
import { ownedSection } from "@/lib/data/access";
import { db } from "@/lib/db";

export const GET = withUser<{ sectionId: string }>(async (_req, user, { sectionId }) => {
  const s = await ownedSection(user.id, sectionId);
  const doc = await db.document.findUnique({ where: { id: s.documentId }, select: { id: true, title: true } });
  return ok({ id: s.id, heading: s.heading, path: s.path, text: s.text, pageStart: s.pageStart, pageEnd: s.pageEnd, document: doc });
});
