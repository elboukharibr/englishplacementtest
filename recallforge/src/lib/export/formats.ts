// Deck export formats. Cloze cards are rendered as front "…[...]…" / back "full sentence"
// so they work everywhere, including Anki's Basic note type.

export type ExportCard = {
  question: string;
  answer: string;
  cardType: string;
  sourcePage: number | null;
  sourceHeading: string | null;
  tags: string[];
  topic: string | null;
};

export function clozeFront(q: string) {
  return q.replace(/\{\{(.+?)\}\}/g, "[...]");
}
export function clozeBack(q: string) {
  return q.replace(/\{\{(.+?)\}\}/g, "$1");
}

export function frontBack(c: ExportCard): { front: string; back: string } {
  if (c.cardType === "cloze") return { front: clozeFront(c.question), back: clozeBack(c.question) };
  return { front: c.question, back: c.answer };
}

export function sourceLabel(c: ExportCard, documentTitle?: string | null) {
  const parts = [documentTitle, c.sourceHeading, c.sourcePage != null ? `p. ${c.sourcePage}` : null].filter(Boolean);
  return parts.join(" — ");
}

function tagList(c: ExportCard) {
  const t = [...c.tags];
  if (c.cardType) t.push(c.cardType);
  return t.map((x) => x.replace(/\s+/g, "_")).join(" ");
}

function csvCell(s: string) {
  // Guard against CSV/formula injection when opened in spreadsheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV: Front, Back, Source, Tags — importable into Anki (File → Import, "Fields separated by: Comma"). */
export function toCsv(cards: ExportCard[], documentTitle?: string | null) {
  const rows = [["Front", "Back", "Source", "Tags"].map(csvCell).join(",")];
  for (const c of cards) {
    const { front, back } = frontBack(c);
    rows.push([front, back, sourceLabel(c, documentTitle), tagList(c)].map(csvCell).join(","));
  }
  return "\uFEFF" + rows.join("\r\n");
}

/** Quizlet import format: term<TAB>definition, one card per line. */
export function toQuizlet(cards: ExportCard[]) {
  return cards
    .map((c) => {
      const { front, back } = frontBack(c);
      return `${front.replace(/[\t\n]+/g, " ")}\t${back.replace(/[\t\n]+/g, " ")}`;
    })
    .join("\n");
}

export function toPlainText(cards: ExportCard[], deckName: string) {
  const lines = [deckName, "=".repeat(deckName.length), ""];
  cards.forEach((c, i) => {
    const { front, back } = frontBack(c);
    lines.push(`${i + 1}. ${front} — ${back}`);
  });
  return lines.join("\n");
}
