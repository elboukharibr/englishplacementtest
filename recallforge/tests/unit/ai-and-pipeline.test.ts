import { describe, it, expect } from "vitest";
import { CardListSchema, EvaluationSchema } from "@/lib/ai/schemas";
import { locateQuote, confidenceLabel } from "@/lib/pipeline/grounding";
import { mergeConcepts, conceptKey } from "@/lib/pipeline/importance";
import { kindsForFocus } from "@/lib/pipeline/focus";
import { costMicros } from "@/lib/ai/cost";
import { hashVector, cosine } from "@/lib/ai/embeddings";
import { batchByWeight, mapLimit } from "@/lib/pipeline/util";

describe("AI response validation", () => {
  it("accepts well-formed cards and rejects malformed ones", () => {
    const good = { cards: [{ question: "Define X.", answer: "Y.", card_type: "definition", difficulty: "basic", concept: "X", source_chunk_id: "s1", supporting_quote: "X is Y.", confidence: 0.9, importance: 80 }] };
    expect(CardListSchema.safeParse(good).success).toBe(true);
    expect(CardListSchema.safeParse({ cards: [{ ...good.cards[0], card_type: "poem" }] }).success).toBe(false);
    expect(CardListSchema.safeParse({ cards: [{ question: "Q" }] }).success).toBe(false);
    expect(EvaluationSchema.safeParse({ scores: { accuracy: 5 } }).success).toBe(false);
  });
});

describe("grounding", () => {
  const text = "Intro sentence here.\n\nPlatformization refers to the penetration of platform infrastructures into society. It reshapes news.";
  const offsets = [{ page: 3, offset: 0 }, { page: 4, offset: 22 }];
  it("finds exact quotes despite whitespace and quote-style differences and maps page from offset", () => {
    const g = locateQuote(text, "Platformization   refers to the penetration of platform infrastructures", offsets, 3);
    expect(g.match).toBe("exact");
    expect(g.page).toBe(4);
  });
  it("falls back to the best matching sentence", () => {
    const g = locateQuote(text, "platformization is the penetration of platform infrastructures into society", offsets, 3);
    expect(g.match).toBe("fuzzy");
    expect(g.quote).toContain("Platformization refers");
  });
  it("rejects quotes that aren't in the source (hallucinations)", () => {
    expect(locateQuote(text, "Quantum entanglement enables faster-than-light messaging.", offsets, 3).match).toBe("none");
  });
  it("labels confidence", () => {
    expect(confidenceLabel(0.9)).toBe("high");
    expect(confidenceLabel(0.65)).toBe("medium");
    expect(confidenceLabel(0.3)).toBe("review");
  });
});

describe("importance scoring and concept merging", () => {
  it("merges plural/article variants and ranks central concepts higher", () => {
    const base = { kind: "concept" as const, summary: "s", is_definition: false, exam_relevant: false, related: [] as string[] };
    const merged = mergeConcepts(
      [
        { ...base, name: "Platform", importance: 60, chunk_id: "a", related: ["Gatekeeping"] },
        { ...base, name: "The platforms", importance: 70, chunk_id: "b" },
        { ...base, name: "Gatekeeping", importance: 70, chunk_id: "a", is_definition: true },
        { ...base, name: "Footnote trivia", importance: 20, chunk_id: "c" },
      ],
      ["Platforms", "Gatekeeping"],
      "platform platform platform gatekeeping footnote trivia",
    );
    expect(merged.length).toBe(3);
    expect(merged[merged.length - 1].name).toBe("Footnote trivia");
    expect(merged.find((m) => m.normalized === conceptKey("platforms"))!.chunkIds.size).toBe(2);
    for (const m of merged) {
      expect(m.importance).toBeGreaterThanOrEqual(0);
      expect(m.importance).toBeLessThanOrEqual(100);
    }
  });
  it("maps focus choices to concept kinds", () => {
    expect([...kindsForFocus(["definitions", "processes"])].sort()).toEqual(["definition", "method", "process"]);
  });
});

describe("cost & embeddings", () => {
  it("computes micro-dollar cost from list prices", () => {
    expect(costMicros("claude-opus-5-5", 1_000_000, 0)).toBe(4_000_000);
    expect(costMicros("unknown-model", 1000, 1000)).toBe(0);
  });
  it("lexical embeddings make paraphrased duplicates closer than unrelated cards", () => {
    const a = hashVector("What is platformization?");
    const b = hashVector("Define platformization.");
    const c = hashVector("Where does glycolysis take place?");
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });
  it("batches by weight and maps with bounded concurrency", async () => {
    expect(batchByWeight([5, 5, 5, 20, 1], (x) => x, 10).map((b) => b.length)).toEqual([2, 1, 1, 1]);
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (x) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return x * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
