import type { ExtractedDocument, SupportedType } from "./types";
import { extractPdf } from "./pdf";
import { extractDocx, extractEpub, extractPlainText, extractPptx } from "./office";

export async function extractDocument(buf: Buffer, type: SupportedType): Promise<ExtractedDocument> {
  switch (type) {
    case "pdf":
      return extractPdf(buf);
    case "docx":
      return extractDocx(buf);
    case "pptx":
      return extractPptx(buf);
    case "epub":
      return extractEpub(buf);
    case "txt":
    case "paste":
      return extractPlainText(buf.toString("utf8"));
  }
}

export * from "./types";
export { buildSections, chunkSections, pageAtOffset } from "./structure";
export { detectFileType, sanitizeFilename, MAX_UPLOAD_BYTES } from "./detect";
