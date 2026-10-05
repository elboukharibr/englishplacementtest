import { extractTextItems, getDocumentProxy, getMeta } from "unpdf";
import type { Block, ExtractedDocument } from "./types";
import { detectRepeatedLines, isPageNumberLine, isRepeatedLine, joinHyphenated } from "./clean";
import { looksLikeHeadingText } from "./structure";

type Line = { text: string; size: number; y: number; page: number; gapAbove: number };

export async function extractPdf(buf: Buffer): Promise<ExtractedDocument> {
  const warnings: string[] = [];
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  let title: string | undefined;
  try {
    const meta = await getMeta(pdf);
    const t = (meta.info as Record<string, unknown> | undefined)?.Title;
    if (typeof t === "string" && t.trim().length > 3) title = t.trim();
  } catch {
    /* metadata is optional */
  }
  const { totalPages, items } = await extractTextItems(pdf);

  // 1. Group text items into lines per page.
  const pageLines: Line[][] = items.map((pageItems, idx) => {
    const lines: Line[] = [];
    let cur: { parts: string[]; size: number; y: number } | null = null;
    for (const it of pageItems) {
      if (!it.str && !it.hasEOL) continue;
      if (cur && Math.abs(it.y - cur.y) > Math.max(2, it.fontSize * 0.5)) {
        lines.push({ text: cur.parts.join("").replace(/\s+/g, " ").trim(), size: cur.size, y: cur.y, page: idx + 1, gapAbove: 0 });
        cur = null;
      }
      if (!cur) cur = { parts: [], size: it.fontSize, y: it.y };
      cur.parts.push(it.str);
      cur.size = Math.max(cur.size, it.fontSize);
      if (it.hasEOL) {
        lines.push({ text: cur.parts.join("").replace(/\s+/g, " ").trim(), size: cur.size, y: cur.y, page: idx + 1, gapAbove: 0 });
        cur = null;
      }
    }
    if (cur) lines.push({ text: cur.parts.join("").replace(/\s+/g, " ").trim(), size: cur.size, y: cur.y, page: idx + 1, gapAbove: 0 });
    const filtered = lines.filter((l) => l.text);
    for (let i = 1; i < filtered.length; i++) filtered[i].gapAbove = filtered[i - 1].y - filtered[i].y;
    return filtered;
  });

  const totalChars = pageLines.reduce((n, p) => n + p.reduce((m, l) => m + l.text.length, 0), 0);
  if (totalChars < 200 * Math.max(1, Math.min(totalPages, 5)) && totalChars / Math.max(1, totalPages) < 100) {
    warnings.push(
      "Very little selectable text was found. This may be a scanned PDF; OCR support is planned but not available yet.",
    );
  }

  // 2. Remove running headers/footers and page numbers.
  const repeated = detectRepeatedLines(pageLines.map((p) => p.map((l) => l.text)));
  let removed = 0;
  const clean = pageLines.map((lines) =>
    lines.filter((l) => {
      const drop = isPageNumberLine(l.text) || isRepeatedLine(l.text, repeated);
      if (drop) removed++;
      return !drop;
    }),
  );

  // 3. Body font size = most common size weighted by characters.
  const sizeWeight = new Map<number, number>();
  for (const p of clean) for (const l of p) {
    const s = Math.round(l.size * 2) / 2;
    sizeWeight.set(s, (sizeWeight.get(s) ?? 0) + l.text.length);
  }
  const bodySize = [...sizeWeight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  const headingSizes = [...sizeWeight.keys()].filter((s) => s >= bodySize * 1.12).sort((a, b) => b - a);
  const levelFor = (size: number) => {
    const idx = headingSizes.findIndex((s) => Math.abs(s - Math.round(size * 2) / 2) < 0.01);
    return idx < 0 ? 3 : Math.min(3, idx + 1);
  };

  // 4. Build blocks: headings from larger fonts (or numbered heading patterns), paragraphs from gaps.
  const blocks: Block[] = [];
  let para: { text: string; page: number } | null = null;
  const flush = () => {
    if (para && para.text.trim()) blocks.push({ kind: "para", text: para.text.trim(), page: para.page });
    para = null;
  };
  for (const lines of clean) {
    const lineHeights = lines.map((l) => l.gapAbove).filter((g) => g > 0).sort((a, b) => a - b);
    const typicalGap = lineHeights[Math.floor(lineHeights.length / 2)] ?? bodySize * 1.2;
    lines.forEach((l, i) => {
      const larger = l.size >= bodySize * 1.12;
      const isHeading = l.text.length <= 140 && (larger ? looksLikeHeadingText(l.text, true) : looksLikeHeadingText(l.text, false) && /^(\d+(\.\d+)*\.?|chapter|part|section)\s/i.test(l.text));
      if (isHeading) {
        flush();
        const prev = blocks[blocks.length - 1];
        // Multi-line headings: merge consecutive heading lines at the same size.
        if (prev && prev.kind === "heading" && prev.page === l.page && larger && prev.level === levelFor(l.size)) {
          prev.text = `${prev.text} ${l.text}`;
        } else {
          blocks.push({ kind: "heading", text: l.text, level: larger ? levelFor(l.size) : 3, page: l.page });
        }
        return;
      }
      const current = para as { text: string; page: number } | null;
      // On the first line of a page, a paragraph continues unless the previous one ended a sentence.
      const newPara = !current || (i === 0 ? /[.!?:]["”’)]?$/.test(current.text) : l.gapAbove > typicalGap * 1.45 || l.gapAbove < 0);
      if (newPara) {
        flush();
        para = { text: l.text, page: l.page };
      } else if (current) {
        current.text = joinHyphenated(current.text, l.text);
      }
    });
  }
  flush();

  if (removed > 0) warnings.push(`Removed ${removed} running header/footer or page-number lines.`);
  const wordCount = blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0);
  return { title, pageCount: totalPages, estimatedPages: totalPages, blocks, wordCount, warnings };
}
