import { withUser, ok } from "@/lib/api";
import { ownedDocument } from "@/lib/data/access";

export const GET = withUser<{ documentId: string }>(async (_req, user, { documentId }) => {
  const doc = await ownedDocument(user.id, documentId);
  return ok({ id: doc.id, status: doc.status, stage: doc.stage, progress: doc.progress, errorReason: doc.errorReason, analysis: doc.analysis, pageCount: doc.pageCount });
});
