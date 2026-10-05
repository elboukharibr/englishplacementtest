import JSZip from "jszip";
import type { SupportedType } from "./types";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Sanitizes a user-supplied filename for display and storage metadata. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const clean = base.normalize("NFKC").replace(/[^\p{L}\p{N}._ ()-]/gu, "_").replace(/_+/g, "_").trim();
  return (clean || "document").slice(0, 150);
}

/**
 * Determines the real file type from magic bytes (never trusting the extension or the
 * browser-reported MIME type alone). Returns null for unsupported or mismatched files.
 */
export async function detectFileType(buf: Buffer, filename: string): Promise<SupportedType | null> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (buf.length < 4) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 3 || buf[2] === 5 || buf[2] === 7);
  if (isZip) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buf);
    } catch {
      return null;
    }
    const mimetype = await zip.file("mimetype")?.async("string");
    if (mimetype?.trim() === "application/epub+zip") return "epub";
    const ct = await zip.file("[Content_Types].xml")?.async("string");
    if (ct?.includes("wordprocessingml.document.main")) return "docx";
    if (ct?.includes("presentationml.presentation.main")) return "pptx";
    return null;
  }
  if (ext === "txt" || ext === "md" || ext === "markdown") {
    // Reject binary content masquerading as text.
    const sample = buf.subarray(0, 4096);
    let nonText = 0;
    for (const b of sample) if (b === 0 || (b < 9 && b !== 0)) nonText++;
    return nonText === 0 ? "txt" : null;
  }
  return null;
}
