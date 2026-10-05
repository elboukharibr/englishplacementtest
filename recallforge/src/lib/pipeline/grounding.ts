// Local, model-independent grounding checks. Page numbers always come from where the
// quote actually sits in the extracted text — never from the model.
import { normalizeText } from "@/lib/utils";
import { pageAtOffset, type PageOffset } from "@/lib/parsing/structure";

export type GroundingResult = {
  quote: string | null;
  match: "exact" | "fuzzy" | "none";
  offset: number | null;
  page: number | null;
};

const MAX_QUOTE = 300;

function squash(s: string) {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

function tokenOverlap(a: string, b: string): number {
  const ta = normalizeText(a).split(" ").filter((w) => w.length > 2);
  const tb = new Set(normalizeText(b).split(" ").filter((w) => w.length > 2));
  if (!ta.length) return 0;
  return ta.filter((w) => tb.has(w)).length / ta.length;
}

export function locateQuote(chunkText: string, quote: string, pageOffsets: PageOffset[] | null, fallbackPage: number | null): GroundingResult {
  const q = squash(quote).replace(/…$/, "").replace(/^\.{3}|\.{3}$/g, "").trim();
  if (q.length >= 8) {
    // Build a squashed copy of the chunk with an index map back to original offsets.
    const map: number[] = [];
    let flat = "";
    let lastSpace = false;
    for (let i = 0; i < chunkText.length; i++) {
      let ch = chunkText[i];
      if (/\s/.test(ch)) {
        if (lastSpace) continue;
        ch = " ";
        lastSpace = true;
      } else lastSpace = false;
      ch = ch.replace(/[“”]/, '"').replace(/[‘’]/, "'").toLowerCase();
      flat += ch;
      map.push(i);
    }
    const idx = flat.indexOf(q);
    if (idx >= 0) {
      const start = map[idx];
      const end = map[Math.min(map.length - 1, idx + q.length - 1)] + 1;
      return { quote: clip(chunkText.slice(start, end)), match: "exact", offset: start, page: pageAtOffset(pageOffsets, start, fallbackPage) };
    }
  }
  // Fuzzy: the sentence in the chunk that best matches the quote.
  const sentences: { text: string; offset: number }[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunkText))) if (m[0].trim().length > 20) sentences.push({ text: m[0].trim(), offset: m.index + (m[0].length - m[0].trimStart().length) });
  let best: { text: string; offset: number; score: number } | null = null;
  for (const s of sentences) {
    const score = tokenOverlap(quote, s.text);
    if (!best || score > best.score) best = { ...s, score };
  }
  if (best && best.score >= 0.6) {
    return { quote: clip(best.text), match: "fuzzy", offset: best.offset, page: pageAtOffset(pageOffsets, best.offset, fallbackPage) };
  }
  return { quote: null, match: "none", offset: null, page: fallbackPage };
}

function clip(s: string) {
  // Copyright-conscious: keep source quotes short.
  return s.length > MAX_QUOTE ? s.slice(0, MAX_QUOTE - 1).replace(/\s\S*$/, "") + "…" : s;
}

export function confidenceLabel(score: number): "high" | "medium" | "review" {
  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  return "review";
}
