import { withUser, ok, jsonError } from "@/lib/api";
import { detectFileType, sanitizeFilename, MAX_UPLOAD_BYTES } from "@/lib/parsing";
import { createDocumentFromBuffer } from "@/lib/data/documents";

export const runtime = "nodejs";

export const POST = withUser(async (req, user) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 1024 * 64) return jsonError("This file is too large (50 MB maximum).", 413, "file_too_large");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError("No file was received.", 400, "no_file");
  if (file.size === 0) return jsonError("This file is empty.", 400, "empty_file");
  if (file.size > MAX_UPLOAD_BYTES) return jsonError("This file is too large (50 MB maximum).", 413, "file_too_large");
  const filename = sanitizeFilename(file.name);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = await detectFileType(buf, filename);
  if (!type) {
    return jsonError("Unsupported file. Upload a PDF, Word (.docx), PowerPoint (.pptx), EPUB or plain-text file.", 415, "unsupported_type");
  }
  const title = String(form?.get("title") ?? "").trim() || filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const doc = await createDocumentFromBuffer(user, { buf, type, filename, title, subject: form?.get("subject") as string | null });
  return ok({ id: doc.id }, { status: 201 });
});
