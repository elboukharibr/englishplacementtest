// Noise removal for paginated text: repeated running headers/footers and bare page numbers.
// Footnotes are deliberately kept — they often carry academically meaningful content.

const PAGE_NUMBER = /^(page\s*)?[-–—]?\s*(\d{1,4}|[ivxlcdm]{1,7})\s*[-–—]?(\s*(of|\/)\s*\d+)?$/i;

export function isPageNumberLine(line: string): boolean {
  return PAGE_NUMBER.test(line.trim());
}

function signature(line: string): string {
  return line.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

/**
 * Given lines per page, returns the set of line signatures that behave like running
 * headers/footers (appear in the first/last 3 lines of at least 30% of pages).
 */
export function detectRepeatedLines(pages: string[][]): Set<string> {
  const repeated = new Set<string>();
  if (pages.length < 4) return repeated;
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const edge = new Set<string>();
    const nonEmpty = lines.filter((l) => l.trim());
    for (const l of [...nonEmpty.slice(0, 3), ...nonEmpty.slice(-3)]) {
      const s = signature(l);
      if (s.length >= 2 && s.length <= 120) edge.add(s);
    }
    for (const s of edge) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.3));
  for (const [s, c] of counts) if (c >= threshold) repeated.add(s);
  return repeated;
}

export function isRepeatedLine(line: string, repeated: Set<string>): boolean {
  return repeated.has(signature(line));
}

/** Joins words split by end-of-line hyphenation: "plat-" + "formization". */
export function joinHyphenated(a: string, b: string): string {
  if (/[a-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return a + " " + b;
}

export const REFERENCE_HEADINGS = /^(\d+(\.\d+)*\.?\s+)?(references|bibliography|works cited|literature cited|sources|further reading|acknowledg(e)?ments?|index)$/i;
