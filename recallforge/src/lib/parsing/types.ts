export type Block = {
  kind: "heading" | "para";
  text: string;
  /** Heading level, 1 = top. Paragraphs inherit nothing. */
  level?: number;
  /** 1-based page number when the format has real pages. */
  page?: number;
};

export type ExtractedDocument = {
  title?: string;
  /** Real page count for PDF/PPTX; null when the format has no pages. */
  pageCount: number | null;
  /** Estimated pages (≈ 500 words/page) when pageCount is null. Used for quotas. */
  estimatedPages: number;
  blocks: Block[];
  wordCount: number;
  warnings: string[];
};

export type SupportedType = "pdf" | "docx" | "pptx" | "epub" | "txt" | "paste";

export const MIME_BY_TYPE: Record<SupportedType, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  epub: "application/epub+zip",
  txt: "text/plain",
  paste: "text/plain",
};
