import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { storage, storageKeyFor } from "@/lib/storage";
import { MIME_BY_TYPE, type SupportedType } from "@/lib/parsing";
import { enqueue } from "@/lib/jobs/queue";
import { assertQuota, incrementUsage } from "@/lib/billing/usage";
import { limitsFor } from "@/lib/billing/plans";
import { enforceRateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/events";
import { UserFacingError } from "@/lib/errors";

export async function createDocumentFromBuffer(user: User, input: { buf: Buffer; type: SupportedType; filename: string; title: string; subject?: string | null; course?: string | null }) {
  await enforceRateLimit(`upload:${user.id}`, 20, 3600);
  await assertQuota(user, "documents");
  const limits = limitsFor(user.plan);
  if (input.buf.length > limits.maxUploadMb * 1024 * 1024) {
    throw new UserFacingError(`This file is larger than ${limits.maxUploadMb} MB, the limit on your plan.`, 413, "file_too_large");
  }
  const doc = await db.document.create({
    data: {
      userId: user.id,
      title: input.title.slice(0, 200),
      filename: input.filename,
      fileType: input.type,
      mimeType: MIME_BY_TYPE[input.type],
      sizeBytes: input.buf.length,
      subject: input.subject?.slice(0, 80) || null,
      course: input.course?.slice(0, 80) || null,
      stage: "Uploaded — waiting to be processed",
      progress: 3,
    },
  });
  const ext = input.type === "paste" ? "txt" : input.type;
  const key = storageKeyFor(user.id, doc.id, ext);
  try {
    await storage().put(key, input.buf, MIME_BY_TYPE[input.type]);
  } catch (e) {
    await db.document.delete({ where: { id: doc.id } });
    console.error("[upload] storage failed", e);
    throw new UserFacingError("We couldn't store your file. Please try again.", 500, "storage_failed");
  }
  await db.document.update({ where: { id: doc.id }, data: { storageKey: key } });
  await incrementUsage(user.id, "documents", 1);
  await enqueue("process_document", { documentId: doc.id }, { userId: user.id, priority: limits.features.priorityProcessing });
  await track("document_uploaded", user.id, { fileType: input.type, bytes: input.buf.length });
  return doc;
}
