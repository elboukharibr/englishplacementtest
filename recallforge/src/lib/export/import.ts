import Papa from "papaparse";

export type ImportedCard = { question: string; answer: string; tags: string[] };

/**
 * Parses CSV or TSV card files. Accepts an optional header row (Front/Back/Tags, Question/Answer,
 * Term/Definition). Extra columns are ignored except a "Tags" column.
 */
export function parseCardFile(text: string, filename: string): { cards: ImportedCard[]; skipped: number } {
  const isTsv = filename.toLowerCase().endsWith(".tsv") || (!text.includes(",") && text.includes("\t")) || /\t/.test(text.split("\n")[0] ?? "");
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { delimiter: isTsv ? "\t" : ",", skipEmptyLines: true });
  const rows = parsed.data.filter((r) => Array.isArray(r) && r.some((c) => c?.trim()));
  if (!rows.length) return { cards: [], skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = ["front", "question", "term", "q"].includes(header[0]);
  const tagIdx = hasHeader ? header.findIndex((h) => h === "tags" || h === "tag") : -1;
  const body = hasHeader ? rows.slice(1) : rows;
  const cards: ImportedCard[] = [];
  let skipped = 0;
  for (const r of body.slice(0, 5000)) {
    const q = (r[0] ?? "").trim();
    const a = (r[1] ?? "").trim();
    if (!q || !a) {
      skipped++;
      continue;
    }
    const tags = tagIdx >= 0 ? (r[tagIdx] ?? "").split(/[\s,]+/).filter(Boolean).slice(0, 10) : [];
    cards.push({ question: q.slice(0, 600), answer: a.slice(0, 800), tags });
  }
  return { cards, skipped };
}
