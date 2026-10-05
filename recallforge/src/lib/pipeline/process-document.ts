// Document pipeline: extract → clean → structure → chunk → embed → extract concepts →
// merge & rank → cached study analysis. Runs in a background job, never in a request.
import { db, toVectorLiteral } from "@/lib/db";
import { storage } from "@/lib/storage";
import { buildSections, chunkSections, extractDocument, type SupportedType } from "@/lib/parsing";
import { getAI } from "@/lib/ai";
import { AIResponseError, AIUnavailableError } from "@/lib/ai/types";
import type { ExtractedConcept } from "@/lib/ai/schemas";
import { getEmbedder } from "@/lib/ai/embeddings";
import { limitsFor } from "@/lib/billing/plans";
import { getUsage, incrementUsage, minutesSavedFor } from "@/lib/billing/usage";
import { UserFacingError } from "@/lib/errors";
import { track } from "@/lib/events";
import { notify } from "@/lib/notifications";
import { mergeConcepts } from "./importance";
import { batchByWeight, mapLimit } from "./util";
import { PermanentJobError } from "@/lib/errors";

export type DocumentAnalysis = {
  pages: number;
  pagesEstimated: boolean;
  words: number;
  readingMinutes: number;
  sections: number;
  concepts: number;
  definitions: number;
  scholars: number;
  theories: number;
  processes: number;
  relationships: number;
  examTopics: number;
  recommendedCards: number;
  manualPrepMinutes: number;
  aiPrepSeconds: number;
  topConcepts: { name: string; kind: string; importance: number }[];
  kindCounts: Record<string, number>;
};

async function setStage(id: string, data: { status?: "EXTRACTING" | "ANALYZING"; stage: string; progress: number }) {
  await db.document.update({ where: { id }, data });
}

export async function processDocument(documentId: string) {
  const started = Date.now();
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { user: true } });
  if (!doc) throw new PermanentJobError("Document no longer exists.");
  if (doc.status === "READY") return;
  const limits = limitsFor(doc.user.plan);

  // ── 1. Extraction ──
  await setStage(documentId, { status: "EXTRACTING", stage: "Extracting text…", progress: 8 });
  if (!doc.storageKey) throw new PermanentJobError("The uploaded file is missing.");
  const buf = await storage().get(doc.storageKey);
  let extracted;
  try {
    extracted = await extractDocument(buf, doc.fileType as SupportedType);
  } catch (e) {
    throw new UserFacingError(
      `We couldn't read this file. ${e instanceof Error && e.message.length < 200 ? e.message : "It may be corrupted, password-protected or in an unusual format."}`,
    );
  }
  const pages = extracted.pageCount ?? extracted.estimatedPages;
  if (pages > limits.pagesPerDocument) {
    throw new UserFacingError(
      `This document has ${pages} pages. The ${doc.user.plan === "FREE" ? "Free" : "Pro"} plan supports up to ${limits.pagesPerDocument} pages per document.${doc.user.plan === "FREE" ? " Split the file or upgrade to Pro for long PDFs." : ""}`,
      402,
      "pages_per_document",
    );
  }
  const usage = await getUsage(doc.userId);
  if (usage.pages + pages > limits.pagesPerPeriod) {
    throw new UserFacingError(`Processing this document would exceed your monthly page allowance (${usage.pages}/${limits.pagesPerPeriod} used).`, 402, "pages");
  }
  if (extracted.wordCount < 40) {
    throw new UserFacingError(
      extracted.warnings.find((w) => w.includes("scanned")) ??
        "We couldn't find enough readable text in this document. If it's a scanned PDF, OCR support is coming soon — for now, try a text-based PDF or paste the text.",
    );
  }

  // ── 2. Structure & chunking ──
  await setStage(documentId, { stage: "Detecting document structure…", progress: 22 });
  const chunks = chunkSections(buildSections(extracted.blocks));
  await db.documentSection.deleteMany({ where: { documentId } });
  await db.documentSection.createMany({
    data: chunks.map((c) => ({
      documentId,
      order: c.order,
      heading: c.heading,
      path: c.path,
      level: c.level,
      text: c.text,
      pageOffsets: c.pageOffsets,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      tokenCount: c.tokenCount,
      isReferences: c.isReferences,
    })),
  });
  const sections = await db.documentSection.findMany({ where: { documentId }, orderBy: { order: "asc" } });
  await db.document.update({
    where: { id: documentId },
    data: {
      pageCount: pages,
      wordCount: extracted.wordCount,
      title: doc.title || extracted.title || doc.filename,
      extractionWarnings: extracted.warnings,
    },
  });
  await incrementUsage(doc.userId, "pages", pages);

  // ── 3. Embeddings for retrieval (RAG / semantic search) ──
  await setStage(documentId, { stage: "Indexing passages for search…", progress: 32 });
  const embedder = getEmbedder();
  const vectors = await embedder.embed(sections.map((s) => `${s.path ?? s.heading ?? ""}\n${s.text}`), { userId: doc.userId });
  for (let i = 0; i < sections.length; i++) {
    await db.$executeRawUnsafe(`UPDATE "DocumentSection" SET "embedding" = $1::vector WHERE "id" = $2`, toVectorLiteral(vectors[i]), sections[i].id);
  }

  // ── 4. Concept extraction (batched, cheap model) ──
  await setStage(documentId, { status: "ANALYZING", stage: "Analyzing concepts…", progress: 40 });
  const ai = getAI();
  const studyable = sections.filter((s) => !s.isReferences);
  const batches = batchByWeight(studyable, (s) => s.tokenCount, 6000);
  let done = 0;
  const results = await mapLimit(batches, 3, async (batch) => {
    const out = await ai.extractConcepts(
      batch.map((s) => ({ id: s.id, heading: s.path ?? s.heading, text: s.text, pageStart: s.pageStart })),
      { userId: doc.userId, purpose: "extract_concepts" },
    );
    done++;
    await setStage(documentId, { stage: `Analyzing concepts… (${done}/${batches.length} parts)`, progress: 40 + Math.round((done / batches.length) * 45) });
    const valid = new Set(batch.map((s) => s.id));
    return out.map((c) => (valid.has(c.chunk_id) ? c : { ...c, chunk_id: batch[0].id }));
  });
  const all: ExtractedConcept[] = results.flat();

  // ── 5. Merge, rank, persist ──
  await setStage(documentId, { stage: "Ranking what matters most…", progress: 88 });
  const merged = mergeConcepts(all, sections.map((s) => s.heading ?? ""), studyable.map((s) => s.text).join("\n"));
  await db.concept.deleteMany({ where: { documentId } });
  const sectionPage = new Map(sections.map((s) => [s.id, s.pageStart]));
  await db.concept.createMany({
    data: merged.map((c) => ({
      documentId,
      sectionId: c.chunkId,
      name: c.name.slice(0, 200),
      normalized: c.normalized.slice(0, 200),
      kind: c.kind,
      summary: c.summary.slice(0, 1000),
      importance: c.importance,
      mentions: c.mentions,
      related: [...c.related].slice(0, 12),
      examRelevant: c.examRelevant || c.importance >= 75,
      pageStart: sectionPage.get(c.chunkId) ?? null,
    })),
  });

  const kindCounts: Record<string, number> = {};
  for (const c of merged) kindCounts[c.kind] = (kindCounts[c.kind] ?? 0) + 1;
  const readingMinutes = Math.round(extracted.wordCount / 200);
  const recommendedCards = Math.max(20, Math.min(120, Math.round(merged.length * 1.6)));
  const analysis: DocumentAnalysis = {
    pages,
    pagesEstimated: extracted.pageCount == null,
    words: extracted.wordCount,
    readingMinutes,
    sections: sections.length,
    concepts: merged.length,
    definitions: merged.filter((c) => c.isDefinition || c.kind === "definition").length,
    scholars: kindCounts.scholar ?? 0,
    theories: kindCounts.theory ?? 0,
    processes: (kindCounts.process ?? 0) + (kindCounts.mechanism ?? 0) + (kindCounts.method ?? 0),
    relationships: merged.reduce((n, c) => n + c.related.size, 0) + (kindCounts.cause_effect ?? 0) + (kindCounts.comparison ?? 0),
    examTopics: merged.filter((c) => c.examRelevant || c.importance >= 75).length,
    recommendedCards,
    // Estimate (see README): a highlighting pass at ~1.5 min/page plus writing cards at ~2.5 min each.
    manualPrepMinutes: Math.round(pages * 1.5 + minutesSavedFor(recommendedCards)),
    aiPrepSeconds: Math.round((Date.now() - started) / 1000),
    topConcepts: merged.slice(0, 12).map((c) => ({ name: c.name, kind: c.kind, importance: c.importance })),
    kindCounts,
  };

  await db.document.update({
    where: { id: documentId },
    data: {
      status: "READY",
      stage: "Ready",
      progress: 100,
      analysis,
      errorReason: null,
      processedAt: new Date(),
      processingMs: Date.now() - started,
    },
  });
  await track("document_processed", doc.userId, { fileType: doc.fileType, pages, concepts: merged.length, ms: Date.now() - started });
  await notify(doc.userId, { kind: "system", title: `“${doc.title}” is analyzed`, body: `We found ${merged.length} concepts. Generate your study deck when you're ready.`, href: `/library/${documentId}`, dedupeKey: `doc-ready-${documentId}` });
}

export function userMessageFor(e: unknown): string {
  if (e instanceof UserFacingError) return e.message;
  if (e instanceof AIUnavailableError) return "The AI service isn't available right now. Your file is saved — please retry in a few minutes.";
  if (e instanceof AIResponseError) return e.message;
  return "Something went wrong while processing this document. Please retry.";
}

export async function markDocumentFailed(documentId: string, e: unknown) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return;
  await db.document.update({ where: { id: documentId }, data: { status: "FAILED", stage: "Failed", errorReason: userMessageFor(e) } });
  await track("document_failed", doc.userId, { fileType: doc.fileType, reason: e instanceof UserFacingError ? e.code ?? "user" : "error" });
}

export async function markDocumentRetrying(documentId: string, e: unknown) {
  await db.document
    .update({ where: { id: documentId }, data: { stage: `Temporary problem — retrying automatically (${userMessageFor(e).slice(0, 120)})` } })
    .catch(() => {});
}
