import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { extractDocument, buildSections, chunkSections, detectFileType, sanitizeFilename, pageAtOffset } from "@/lib/parsing";
import { detectRepeatedLines, isPageNumberLine } from "@/lib/parsing/clean";
import { extractPlainText } from "@/lib/parsing/office";
import { makeTextbookPdf } from "../fixtures/make-pdf";

describe("PDF extraction", () => {
  it("keeps real page numbers, detects headings, and strips running headers and page numbers", async () => {
    const buf = await makeTextbookPdf(9);
    expect(await detectFileType(buf, "chapter.pdf")).toBe("pdf");
    const doc = await extractDocument(buf, "pdf");
    expect(doc.pageCount).toBe(9);
    const text = doc.blocks.map((b) => b.text).join("\n");
    expect(text).not.toContain("Digital Media Theory — Chapter 4");
    const headings = doc.blocks.filter((b) => b.kind === "heading").map((b) => b.text);
    expect(headings).toEqual(["1. Platformization", "2. Mediatization", "3. Algorithmic curation"]);
    const def = doc.blocks.find((b) => b.text.startsWith("Algorithmic curation is the automated"));
    expect(def?.page).toBe(2);
    expect(doc.warnings.join(" ")).toMatch(/Removed \d+ running header/);
  });

  it("maps quote offsets back to pages", async () => {
    const doc = await extractDocument(await makeTextbookPdf(6), "pdf");
    const chunks = chunkSections(buildSections(doc.blocks));
    const c = chunks.find((x) => x.pageStart !== x.pageEnd) ?? chunks[0];
    const lastPage = c.pageOffsets[c.pageOffsets.length - 1];
    expect(pageAtOffset(c.pageOffsets, lastPage.offset + 5, null)).toBe(lastPage.page);
    expect(pageAtOffset(c.pageOffsets, 0, null)).toBe(c.pageOffsets[0].page);
  });
});

describe("cleanup helpers", () => {
  it("recognises page-number lines", () => {
    for (const s of ["12", "- 12 -", "Page 4", "iv", "3 of 20"]) expect(isPageNumberLine(s)).toBe(true);
    expect(isPageNumberLine("1950 was a key year")).toBe(false);
  });
  it("detects repeated running headers", () => {
    const pages = Array.from({ length: 6 }, (_, i) => ["Journal of Media Studies, vol. 3", `Body text ${i}`, `${i + 1}`]);
    const rep = detectRepeatedLines(pages);
    expect(rep.has("journal of media studies, vol. #")).toBe(true);
  });
});

describe("plain text & structure", () => {
  it("detects markdown headings and excludes reference sections", () => {
    const doc = extractPlainText("# Chapter 1\n\nIntro paragraph that is long enough.\n\n## Theory\n\nSome theory text here.\n\n## References\n\nSmith (2020). A book.");
    const sections = buildSections(doc.blocks);
    expect(sections.map((s) => s.heading)).toEqual(["Chapter 1", "Theory", "References"]);
    expect(sections.find((s) => s.heading === "References")!.isReferences).toBe(true);
    expect(sections.find((s) => s.heading === "Theory")!.path).toEqual(["Chapter 1", "Theory"]);
  });
  it("splits long sections into token-bounded chunks", () => {
    const para = "This is a sentence about platform power and visibility. ".repeat(60);
    const doc = extractPlainText(`# Big\n\n${para}\n\n${para}\n\n${para}\n\n${para}`);
    const chunks = chunkSections(buildSections(doc.blocks));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(1400);
  });
});

describe("file validation", () => {
  it("rejects files whose content doesn't match a supported type", async () => {
    expect(await detectFileType(Buffer.from("MZ\x90\x00 binary"), "evil.pdf")).toBeNull();
    expect(await detectFileType(Buffer.from("hello\u0000world"), "notes.txt")).toBeNull();
    expect(await detectFileType(Buffer.from("plain notes"), "notes.txt")).toBe("txt");
  });
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("my<script>.pdf")).toBe("my_script_.pdf");
  });
  it("has the generated fixture on disk", () => {
    expect(fs.existsSync(path.join(__dirname, "../fixtures/textbook-60.pdf"))).toBe(true);
  });
});
