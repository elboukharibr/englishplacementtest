import mammoth from "mammoth";
import JSZip from "jszip";
import type { Block, ExtractedDocument } from "./types";
import { decodeEntities, htmlToBlocks } from "./html";

const WORDS_PER_PAGE = 500;

function finish(blocks: Block[], warnings: string[], title?: string, pageCount: number | null = null): ExtractedDocument {
  const wordCount = blocks.reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);
  return {
    title,
    pageCount,
    estimatedPages: pageCount ?? Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE)),
    blocks,
    wordCount,
    warnings,
  };
}

export async function extractDocx(buf: Buffer): Promise<ExtractedDocument> {
  const { value: html, messages } = await mammoth.convertToHtml({ buffer: buf });
  const blocks = htmlToBlocks(html);
  const warnings = messages.filter((m) => m.type === "error").map((m) => m.message).slice(0, 5);
  warnings.push("Word documents have no fixed pages; page references are estimated from word count.");
  const firstHeading = blocks.find((b) => b.kind === "heading");
  // Estimate pages so citations can still point somewhere useful.
  let words = 0;
  for (const b of blocks) {
    b.page = Math.floor(words / WORDS_PER_PAGE) + 1;
    words += b.text.split(/\s+/).length;
  }
  return finish(blocks, warnings, firstHeading?.text);
}

function xmlText(xml: string): string[] {
  // Each <a:p> is a paragraph made of <a:t> runs.
  const paras: string[] = [];
  for (const p of xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p [\s\S]*?<\/a:p>/g) ?? []) {
    const runs = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeEntities(m[1]));
    const t = runs.join("").replace(/\s+/g, " ").trim();
    if (t) paras.push(t);
  }
  return paras;
}

export async function extractPptx(buf: Buffer): Promise<ExtractedDocument> {
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const blocks: Block[] = [];
  let i = 0;
  for (const f of slideFiles) {
    i++;
    const xml = await zip.file(f)!.async("string");
    // Title placeholder shape, if present.
    const titleShape = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph type="(?:title|ctrTitle)"[\s\S]*?<\/p:sp>/);
    const title = titleShape ? xmlText(titleShape[0]).join(" ") : undefined;
    const body = xmlText(titleShape ? xml.replace(titleShape[0], "") : xml);
    blocks.push({ kind: "heading", level: 2, text: title || `Slide ${i}`, page: i });
    for (const t of body) blocks.push({ kind: "para", text: t, page: i });
    const notesPath = `ppt/notesSlides/notesSlide${f.match(/(\d+)\.xml$/)![1]}.xml`;
    const notes = zip.file(notesPath);
    if (notes) {
      const n = xmlText(await notes.async("string")).filter((t) => !/^\d+$/.test(t));
      if (n.length) blocks.push({ kind: "para", text: `Speaker notes: ${n.join(" ")}`, page: i });
    }
  }
  const title = blocks.find((b) => b.kind === "heading" && !/^Slide \d+$/.test(b.text))?.text;
  return finish(blocks, [], title, slideFiles.length);
}

export async function extractEpub(buf: Buffer): Promise<ExtractedDocument> {
  const zip = await JSZip.loadAsync(buf);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("This EPUB is missing its package manifest.");
  const opf = await zip.file(opfPath)!.async("string");
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = m[0].match(/id="([^"]+)"/)?.[1];
    const href = m[0].match(/href="([^"]+)"/)?.[1];
    if (id && href) manifest.set(id, decodeURIComponent(href));
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => m[1]);
  const title = opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/)?.[1]?.trim();
  const blocks: Block[] = [];
  let chapter = 0;
  for (const id of spine) {
    const href = manifest.get(id);
    if (!href) continue;
    const file = zip.file(base + href);
    if (!file) continue;
    chapter++;
    blocks.push(...htmlToBlocks(await file.async("string"), chapter));
  }
  if (!blocks.length) throw new Error("No readable text was found in this EPUB (it may be DRM-protected).");
  return finish(blocks, ["EPUB files have no fixed pages; references point to the chapter number."], title ? decodeEntities(title) : undefined);
}

export function extractPlainText(text: string): ExtractedDocument {
  const blocks: Block[] = [];
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const raw of paragraphs) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const md = lines[0].match(/^(#{1,6})\s+(.+)$/);
    if (md) {
      blocks.push({ kind: "heading", level: md[1].length, text: md[2].trim() });
      if (lines.length > 1) blocks.push({ kind: "para", text: lines.slice(1).join(" ") });
      continue;
    }
    if (lines.length === 1 && lines[0].length < 90 && !/[.!?,;]$/.test(lines[0]) && /^[\p{Lu}\d]/u.test(lines[0])) {
      const numbered = lines[0].match(/^(\d+(?:\.\d+)*)\.?\s/);
      blocks.push({ kind: "heading", level: numbered ? Math.min(3, numbered[1].split(".").length) : 2, text: lines[0] });
      continue;
    }
    blocks.push({ kind: "para", text: lines.join(" ") });
  }
  let words = 0;
  for (const b of blocks) {
    b.page = Math.floor(words / WORDS_PER_PAGE) + 1;
    words += b.text.split(/\s+/).length;
  }
  return finish(blocks, ["Plain text has no pages; page references are estimated (≈500 words per page)."]);
}
