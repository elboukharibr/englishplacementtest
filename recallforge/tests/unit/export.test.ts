import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { toCsv, toQuizlet, toPlainText, clozeFront, clozeBack } from "@/lib/export/formats";
import { buildApkg } from "@/lib/export/apkg";
import { parseCardFile } from "@/lib/export/import";
import { DEMO_SUBJECTS } from "@/lib/data/sample-content";

const cards = [
  { id: "c1", question: "Define platformization.", answer: "Penetration of platforms, \"with quotes\", into society.", cardType: "definition", sourcePage: 24, sourceHeading: "Algorithmic Visibility", tags: ["media"], topic: null },
  { id: "c2", question: "Visibility is redistributed through {{algorithms}}.", answer: "algorithms", cardType: "cloze", sourcePage: null, sourceHeading: null, tags: [], topic: null },
  { id: "c3", question: "=HYPERLINK(\"x\")", answer: "formula injection attempt", cardType: "basic", sourcePage: null, sourceHeading: null, tags: [], topic: null },
];

describe("exports", () => {
  it("writes CSV with Front, Back, Source, Tags and escapes safely", () => {
    const csv = toCsv(cards, "Chapter 4");
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe('"Front","Back","Source","Tags"');
    expect(lines[1]).toContain('""with quotes""');
    expect(lines[1]).toContain("Chapter 4 — Algorithmic Visibility — p. 24");
    expect(lines[2]).toContain("[...]");
    expect(lines[3].startsWith(`"'=HYPERLINK`)).toBe(true);
  });
  it("writes Quizlet tab-separated and plain text", () => {
    expect(toQuizlet(cards).split("\n")[0]).toBe('Define platformization.\tPenetration of platforms, "with quotes", into society.');
    expect(toPlainText(cards, "Deck")).toContain("1. Define platformization. — ");
    expect(clozeFront(cards[1].question)).toBe("Visibility is redistributed through [...].");
    expect(clozeBack(cards[1].question)).toBe("Visibility is redistributed through algorithms.");
  });
  it("builds a valid Anki .apkg (zip with a SQLite collection)", async () => {
    const buf = await buildApkg({ deckId: "deck1", deckName: "Media Theory", documentTitle: "Chapter 4", cards });
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files).sort()).toEqual(["collection.anki2", "media"]);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SQL = await require("sql.js/dist/sql-asm.js")();
    const db = new SQL.Database(await zip.file("collection.anki2")!.async("uint8array"));
    expect(db.exec("select count(*) from notes")[0].values[0][0]).toBe(3);
    expect(db.exec("select count(*) from cards")[0].values[0][0]).toBe(3);
    const decks = JSON.parse(db.exec("select decks from col")[0].values[0][0] as string);
    expect(Object.values(decks).map((d) => (d as { name: string }).name)).toContain("Media Theory");
    const flds = db.exec("select flds from notes")[0].values.map((r: unknown[]) => String(r[0]).split("\x1f"));
    const first = flds.find((f: string[]) => f[0].startsWith("Define platformization"))!;
    expect(first[2]).toContain("p. 24");
  });
});

describe("import", () => {
  it("parses CSV with header and tags", () => {
    const r = parseCardFile('Front,Back,Tags\n"What is X?","Y","a b"\n,missing\n', "cards.csv");
    expect(r.cards).toEqual([{ question: "What is X?", answer: "Y", tags: ["a", "b"] }]);
    expect(r.skipped).toBe(1);
  });
  it("parses TSV without header", () => {
    const r = parseCardFile("mitochondria\tpowerhouse of the cell\nribosome\tsite of protein synthesis", "q.tsv");
    expect(r.cards.length).toBe(2);
  });
});

describe("sample content", () => {
  it("every sample card quote appears verbatim in its section", () => {
    for (const s of DEMO_SUBJECTS) for (const c of s.cards) expect(s.sections[c.section].text).toContain(c.quote);
  });
});
