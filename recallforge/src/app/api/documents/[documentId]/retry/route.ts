import { db } from "@/lib/db";
import { withUser, ok, jsonError } from "@/lib/api";
import { ownedDocument } from "@/lib/data/access";
import { enqueue } from "@/lib/jobs/queue";
import { limitsFor } from "@/lib/billing/plans";

export const POST = withUser<{ documentId: string }>(async (_req, user, { documentId }) => {
  const doc = await ownedDocument(user.id, documentId);
  if (doc.status !== "FAILED") return jsonError("Only failed documents can be retried.", 409);
  await db.document.update({ where: { id: doc.id }, data: { status: "UPLOADED", stage: "Queued for another attempt", progress: 3, errorReason: null } });
  await enqueue("process_document", { documentId: doc.id }, { userId: user.id, priority: limitsFor(user.plan).features.priorityProcessing });
  return ok();
});
