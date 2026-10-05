// Importance scoring (0–100) for extracted concepts, combining the model's judgement with
// document-level signals the model can't see from a single chunk.
import { normalizeText } from "@/lib/utils";
import type { ExtractedConcept } from "@/lib/ai/schemas";

export type MergedConcept = {
  name: string;
  normalized: string;
  kind: ExtractedConcept["kind"];
  summary: string;
  chunkId: string;
  modelImportance: number;
  isDefinition: boolean;
  examRelevant: boolean;
  related: Set<string>;
  chunkIds: Set<string>;
  mentions: number;
  inHeading: boolean;
  importance: number;
};

export function conceptKey(name: string): string {
  return normalizeText(name)
    .replace(/^(the|a|an)\s+/, "")
    .split(" ")
    .map((w) => (w.length > 4 ? w.replace(/(ies)$/, "y").replace(/([^s])s$/, "$1") : w))
    .join(" ");
}

export function mergeConcepts(items: ExtractedConcept[], headings: string[], fullText: string): MergedConcept[] {
  const byKey = new Map<string, MergedConcept>();
  for (const c of items) {
    const key = conceptKey(c.name);
    if (!key || key.length < 2) continue;
    const existing = byKey.get(key);
    const imp = Math.max(0, Math.min(100, Number(c.importance) || 0));
    if (!existing) {
      byKey.set(key, {
        name: c.name.trim(),
        normalized: key,
        kind: c.kind,
        summary: c.summary.trim(),
        chunkId: c.chunk_id,
        modelImportance: imp,
        isDefinition: c.is_definition,
        examRelevant: c.exam_relevant,
        related: new Set(c.related.map((r) => r.trim()).filter(Boolean)),
        chunkIds: new Set([c.chunk_id]),
        mentions: 0,
        inHeading: false,
        importance: 0,
      });
    } else {
      // Keep the richest description and the strongest signals.
      if (imp > existing.modelImportance) {
        existing.chunkId = c.chunk_id;
        existing.summary = c.summary.trim();
      }
      if (c.is_definition && !existing.isDefinition) existing.kind = c.kind;
      existing.modelImportance = Math.max(existing.modelImportance, imp);
      existing.isDefinition ||= c.is_definition;
      existing.examRelevant ||= c.exam_relevant;
      c.related.forEach((r) => existing.related.add(r.trim()));
      existing.chunkIds.add(c.chunk_id);
    }
  }

  const normText = " " + normalizeText(fullText) + " ";
  const normHeadings = headings.map((h) => normalizeText(h));
  const merged = [...byKey.values()];
  for (const c of merged) {
    const needle = " " + normalizeText(c.name) + " ";
    let count = 0;
    let from = 0;
    while (needle.trim().length > 2 && (from = normText.indexOf(needle, from)) !== -1) {
      count++;
      from += needle.length - 1;
    }
    c.mentions = Math.max(count, c.chunkIds.size);
    c.inHeading = normHeadings.some((h) => h.includes(normalizeText(c.name)));
  }
  const maxMentions = Math.max(1, ...merged.map((c) => c.mentions));
  const relatedCounts = new Map<string, number>();
  for (const c of merged) for (const r of c.related) relatedCounts.set(conceptKey(r), (relatedCounts.get(conceptKey(r)) ?? 0) + 1);

  for (const c of merged) c.importance = scoreImportance(c, maxMentions, relatedCounts.get(c.normalized) ?? 0);
  return merged.sort((a, b) => b.importance - a.importance);
}

export function scoreImportance(c: Pick<MergedConcept, "modelImportance" | "mentions" | "inHeading" | "isDefinition" | "examRelevant" | "chunkIds">, maxMentions: number, inboundRelations: number): number {
  const frequency = Math.log1p(c.mentions) / Math.log1p(maxMentions); // 0..1
  const spread = Math.min(1, (c.chunkIds.size - 1) / 3); // repeated emphasis across sections
  const centrality = Math.min(1, inboundRelations / 4);
  const score =
    0.5 * c.modelImportance +
    15 * frequency +
    8 * spread +
    7 * centrality +
    (c.inHeading ? 8 : 0) +
    (c.isDefinition ? 6 : 0) +
    (c.examRelevant ? 6 : 0);
  return Math.round(Math.max(0, Math.min(100, score)));
}
