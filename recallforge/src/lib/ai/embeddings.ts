// Embedding providers. Vectors are 1536-dimensional to match the pgvector columns.
import OpenAI from "openai";
import { env } from "@/lib/env";
import { normalizeText } from "@/lib/utils";
import { recordAiCall } from "./accounting";

export const EMBEDDING_DIMS = 1536;

export interface Embedder {
  readonly name: string;
  embed(texts: string[], ctx?: { userId?: string | null }): Promise<number[][]>;
}

/**
 * Lexical fallback: signed feature hashing of word unigrams and bigrams.
 * Captures shared vocabulary, not meaning. Fine for dedup of near-identical phrasing
 * and keyword-ish retrieval; use OpenAI embeddings for true semantic search.
 */
export class HashingEmbedder implements Embedder {
  readonly name = "local-hashing";
  async embed(texts: string[]) {
    return texts.map((t) => hashVector(t));
  }
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const STOP = new Set("the a an of to in and or is are was were be by for on with as that this it its from at which what how why who does do define".split(" "));

function stem(w: string) {
  return w.replace(/(ing|ed|es|s|ly|ation|ations|ization|izations)$/, "") || w;
}

export function hashVector(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMS).fill(0);
  const words = normalizeText(text).split(" ").filter((w) => w && !STOP.has(w)).map(stem);
  const feats: string[] = [...words];
  for (let i = 0; i + 1 < words.length; i++) feats.push(words[i] + "_" + words[i + 1]);
  for (const f of feats) {
    const h = fnv1a(f);
    v[h % EMBEDDING_DIMS] += (h & 0x80000000 ? -1 : 1) * (f.includes("_") ? 0.5 : 1);
  }
  const norm = Math.sqrt(v.reduce((n, x) => n + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

class OpenAIEmbedder implements Embedder {
  readonly name = "openai:text-embedding-3-small";
  private client: OpenAI;
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, maxRetries: 3 });
  }
  async embed(texts: string[], ctx?: { userId?: string | null }) {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 96) {
      const batch = texts.slice(i, i + 96).map((t) => t.slice(0, 24000) || " ");
      const started = Date.now();
      const res = await this.client.embeddings.create({ model: "text-embedding-3-small", input: batch, dimensions: EMBEDDING_DIMS });
      await recordAiCall({ userId: ctx?.userId, purpose: "embedding", provider: "openai", model: "text-embedding-3-small", tokensIn: res.usage.prompt_tokens, tokensOut: 0, latencyMs: Date.now() - started, ok: true });
      out.push(...res.data.map((d) => d.embedding));
    }
    return out;
  }
}

let embedder: Embedder | null = null;
export function getEmbedder(): Embedder {
  if (embedder) return embedder;
  embedder = env.embeddingProvider === "openai" && env.openaiKey ? new OpenAIEmbedder(env.openaiKey) : new HashingEmbedder();
  return embedder;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
