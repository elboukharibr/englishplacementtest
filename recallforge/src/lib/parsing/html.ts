import type { Block } from "./types";

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** Converts (X)HTML into heading/paragraph blocks. Good enough for mammoth output and EPUB chapters. */
export function htmlToBlocks(html: string, page?: number): Block[] {
  const body = html.replace(/<head[\s\S]*?<\/head>/i, "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  const blocks: Block[] = [];
  const re = /<(h[1-6]|p|li|blockquote|td|th|figcaption|dt|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]);
    if (!text) continue;
    if (tag[0] === "h" && tag.length === 2) blocks.push({ kind: "heading", level: Number(tag[1]), text, page });
    else blocks.push({ kind: "para", text: tag === "li" ? `• ${text}` : text, page });
  }
  return blocks;
}
