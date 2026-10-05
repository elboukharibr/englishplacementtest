// Turns a flat list of heading/paragraph blocks into sections with breadcrumbs,
// exact page offsets, and token-aware chunks suitable for LLM calls and RAG.
import type { Block } from "./types";
import { REFERENCE_HEADINGS } from "./clean";
import { estimateTokens } from "@/lib/utils";

export function looksLikeHeadingText(text: string, largerFont: boolean): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 140) return false;
  if (/[.,;]$/.test(t) && !/^\d+(\.\d+)*\.$/.test(t)) return false; // sentence-like
  if (/^[•\-–*]/.test(t)) return false; // bullet
  if (!/\p{L}/u.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 18) return false;
  if (largerFont) return true;
  return /^(\d+(\.\d+)*\.?|chapter|part|section)\s/i.test(t);
}

export type PageOffset = { page: number; offset: number };

export type Chunk = {
  order: number;
  heading: string | null;
  path: string | null;
  level: number;
  text: string;
  pageOffsets: PageOffset[];
  pageStart: number | null;
  pageEnd: number | null;
  tokenCount: number;
  isReferences: boolean;
};

type Draft = { heading: string | null; path: string[]; level: number; paras: { text: string; page?: number }[]; isReferences: boolean };

export function buildSections(blocks: Block[]): Draft[] {
  const sections: Draft[] = [];
  const stack: { level: number; text: string }[] = [];
  let current: Draft = { heading: null, path: [], level: 1, paras: [], isReferences: false };
  let inReferences = false;
  let referencesLevel = 99;

  for (const b of blocks) {
    if (b.kind === "heading") {
      if (current.paras.length) sections.push(current);
      const level = b.level ?? 2;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, text: b.text });
      if (REFERENCE_HEADINGS.test(b.text.trim())) {
        inReferences = true;
        referencesLevel = level;
      } else if (inReferences && level <= referencesLevel) {
        inReferences = false;
      }
      current = { heading: b.text, path: stack.map((s) => s.text), level, paras: [], isReferences: inReferences };
    } else {
      current.paras.push({ text: b.text, page: b.page });
    }
  }
  if (current.paras.length) sections.push(current);
  return sections;
}

const TARGET_TOKENS = 900;
const MAX_TOKENS = 1300;

/** Splits sections into chunks of roughly TARGET_TOKENS at paragraph boundaries. */
export function chunkSections(sections: Draft[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const s of sections) {
    const parts: { text: string; page?: number }[][] = [];
    let cur: { text: string; page?: number }[] = [];
    let tokens = 0;
    for (const p of splitLongParas(s.paras)) {
      const t = estimateTokens(p.text);
      if (cur.length && tokens + t > TARGET_TOKENS) {
        parts.push(cur);
        cur = [];
        tokens = 0;
      }
      cur.push(p);
      tokens += t;
    }
    if (cur.length) parts.push(cur);
    // Fold a tiny trailing part into the previous one.
    if (parts.length > 1 && parts[parts.length - 1].reduce((n, p) => n + estimateTokens(p.text), 0) < 150) {
      const last = parts.pop()!;
      parts[parts.length - 1].push(...last);
    }
    parts.forEach((paras, i) => {
      let text = "";
      const pageOffsets: PageOffset[] = [];
      for (const p of paras) {
        if (text) text += "\n\n";
        if (p.page != null && (pageOffsets.length === 0 || pageOffsets[pageOffsets.length - 1].page !== p.page)) {
          pageOffsets.push({ page: p.page, offset: text.length });
        }
        text += p.text;
      }
      const pages = paras.map((p) => p.page).filter((n): n is number => n != null);
      const heading = s.heading ? (parts.length > 1 ? `${s.heading} (part ${i + 1})` : s.heading) : null;
      chunks.push({
        order: chunks.length,
        heading,
        path: s.path.length ? s.path.join(" › ") : null,
        level: s.level,
        text,
        pageOffsets,
        pageStart: pages.length ? Math.min(...pages) : null,
        pageEnd: pages.length ? Math.max(...pages) : null,
        tokenCount: estimateTokens(text),
        isReferences: s.isReferences,
      });
    });
  }
  return chunks;
}

function splitLongParas(paras: { text: string; page?: number }[]) {
  const out: { text: string; page?: number }[] = [];
  for (const p of paras) {
    if (estimateTokens(p.text) <= MAX_TOKENS) {
      out.push(p);
      continue;
    }
    const sentences = p.text.match(/[^.!?]+[.!?]+["”’)]?\s*|[^.!?]+$/g) ?? [p.text];
    let buf = "";
    for (const s of sentences) {
      if (estimateTokens(buf + s) > TARGET_TOKENS && buf) {
        out.push({ text: buf.trim(), page: p.page });
        buf = "";
      }
      buf += s;
    }
    if (buf.trim()) out.push({ text: buf.trim(), page: p.page });
  }
  return out;
}

/** Maps a character offset inside a chunk to its page using recorded page offsets. */
export function pageAtOffset(pageOffsets: PageOffset[] | null | undefined, offset: number, fallback: number | null): number | null {
  if (!pageOffsets || !pageOffsets.length) return fallback;
  let page = pageOffsets[0].page;
  for (const po of pageOffsets) {
    if (po.offset <= offset) page = po.page;
    else break;
  }
  return page;
}
