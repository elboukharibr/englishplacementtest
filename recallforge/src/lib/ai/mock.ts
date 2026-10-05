// Deterministic, offline provider for automated tests and local development without API keys.
// It uses simple text heuristics — it is NOT a substitute for a real model, and the UI labels
// it as such (see AI_PROVIDER=mock in README).
import type { AIProvider, CardForVerification, ChatMessage, ConceptBrief, GenerationSettings, SourceChunk } from "./types";
import type { CandidateCard, Difficulty, Evaluation, ExamQuestion, ExtractedConcept, ImproveAction, Verification } from "./schemas";
import { normalizeText } from "@/lib/utils";

function sentences(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 25);
}

const DEF_RE = /^(?:The |An |A )?([A-Z][\p{L}\p{N} '’-]{2,60}?)\s+(?:is|are|refers to|describes|denotes|means|can be defined as)\s+(.{15,})$/u;
const SCHOLAR_RE = /([A-Z][a-z]+(?:\s(?:and|&)\s[A-Z][a-z]+)?)\s\((\d{4})\)/;
const CAUSE_RE = /^(.{10,120}?)\s(?:because|leads to|results in|causes|therefore)\s(.{10,})$/i;

type Found = { name: string; kind: ExtractedConcept["kind"]; summary: string; quote: string; chunkId: string; score: number };

function analyse(chunks: SourceChunk[]): Found[] {
  const found: Found[] = [];
  for (const c of chunks) {
    for (const s of sentences(c.text)) {
      const d = s.match(DEF_RE);
      if (d && d[1].split(" ").length <= 6) {
        found.push({ name: d[1].trim(), kind: "definition", summary: s, quote: s, chunkId: c.id, score: 80 });
        continue;
      }
      const sch = s.match(SCHOLAR_RE);
      if (sch) {
        found.push({ name: sch[1], kind: "scholar", summary: s, quote: s, chunkId: c.id, score: 65 });
        continue;
      }
      const ce = s.match(CAUSE_RE);
      if (ce) found.push({ name: ce[1].split(" ").slice(0, 5).join(" "), kind: "cause_effect", summary: s, quote: s, chunkId: c.id, score: 55 });
    }
    if (c.heading && !/^slide \d+$/i.test(c.heading)) {
      const first = sentences(c.text)[0];
      if (first) found.push({ name: c.heading.replace(/\s*\(part \d+\)$/, ""), kind: "concept", summary: first, quote: first, chunkId: c.id, score: 60 });
    }
  }
  const seen = new Set<string>();
  return found.filter((f) => {
    const k = normalizeText(f.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function shortAnswer(summary: string, name: string): string {
  const d = summary.match(DEF_RE);
  let a = d ? d[2] : summary;
  a = a.replace(/\.$/, "");
  if (a.length > 180) a = a.slice(0, 177).replace(/\s\S*$/, "") + "…";
  return a.charAt(0).toUpperCase() + a.slice(1) + (a.endsWith("…") ? "" : ".") || name;
}

function overlap(a: string, b: string): number {
  const ta = new Set(normalizeText(a).split(" ").filter((w) => w.length > 3));
  const tb = new Set(normalizeText(b).split(" ").filter((w) => w.length > 3));
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const w of ta) if (tb.has(w)) n++;
  return n / tb.size;
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async extractConcepts(chunks: SourceChunk[]): Promise<ExtractedConcept[]> {
    return analyse(chunks).map((f) => ({
      name: f.name,
      kind: f.kind,
      summary: f.summary,
      importance: f.score,
      is_definition: f.kind === "definition",
      exam_relevant: f.score >= 70,
      chunk_id: f.chunkId,
      related: [],
    }));
  }

  async generateCards(input: { chunks: SourceChunk[]; concepts: ConceptBrief[]; count: number; settings: GenerationSettings }): Promise<CandidateCard[]> {
    const pool = analyse(input.chunks);
    const cards: CandidateCard[] = [];
    const types = input.settings.cardTypes;
    let i = 0;
    for (const f of pool) {
      if (cards.length >= input.count) break;
      const answer = shortAnswer(f.summary, f.name);
      const wantCloze = types.includes("cloze") && i % 4 === 3;
      const base = {
        difficulty: input.settings.difficulty,
        concept: f.name,
        source_chunk_id: f.chunkId,
        supporting_quote: f.quote.slice(0, 280),
        confidence: f.kind === "definition" ? 0.92 : f.kind === "concept" ? 0.6 : 0.75,
        importance: f.score,
      };
      if (wantCloze && f.quote.toLowerCase().includes(f.name.toLowerCase())) {
        const idx = f.quote.toLowerCase().indexOf(f.name.toLowerCase());
        const q = f.quote.slice(0, idx) + `{{${f.quote.slice(idx, idx + f.name.length)}}}` + f.quote.slice(idx + f.name.length);
        cards.push({ ...base, question: q, answer: f.name, card_type: "cloze" });
      } else if (f.kind === "definition") {
        cards.push({ ...base, question: types.includes("definition") ? `Define ${f.name}.` : `What is ${f.name}?`, answer, card_type: types.includes("definition") ? "definition" : "basic" });
      } else if (f.kind === "scholar") {
        cards.push({ ...base, question: `What is ${f.name} associated with in this material?`, answer, card_type: "scholar" });
      } else if (f.kind === "cause_effect") {
        cards.push({ ...base, question: `What is the effect described for: ${f.name}?`, answer, card_type: "cause_effect" });
      } else {
        cards.push({ ...base, question: `What is the main idea of "${f.name}"?`, answer, card_type: "basic" });
      }
      i++;
    }
    return cards;
  }

  async verifyCards(cards: CardForVerification[]): Promise<Verification[]> {
    return cards.map((c) => {
      const answerCore = c.answer.replace(/[{}…]/g, "");
      const score = overlap(c.sourceText, answerCore);
      const verdict = score > 0.6 ? "supported" : score > 0.3 ? "partially_supported" : "unsupported";
      return { id: c.id, verdict, confidence: Math.min(0.95, 0.4 + score / 2), issues: verdict === "supported" ? "" : "Answer wording only partly matches the source.", corrected_answer: "" };
    });
  }

  async improveCard(input: { card: { question: string; answer: string; cardType: string; difficulty: string }; action: ImproveAction; chunk: SourceChunk }): Promise<CandidateCard[]> {
    const quote = sentences(input.chunk.text).find((s) => overlap(s, input.card.answer) > 0.3) ?? sentences(input.chunk.text)[0] ?? input.chunk.text.slice(0, 200);
    const base = { difficulty: input.card.difficulty as Difficulty, concept: input.card.question.slice(0, 60), source_chunk_id: input.chunk.id, supporting_quote: quote, confidence: 0.7, importance: 60 };
    const q = input.card.question;
    const a = input.card.answer;
    switch (input.action) {
      case "shorter":
        return [{ ...base, question: q, answer: a.split(/[,;]/)[0].replace(/\.?$/, "."), card_type: input.card.cardType as CandidateCard["card_type"] }];
      case "harder":
        return [{ ...base, question: `Explain why this matters: ${q.replace(/\?$/, "")}?`, answer: a, card_type: "critical", difficulty: "advanced" }];
      case "easier":
        return [{ ...base, question: q, answer: a, card_type: "basic", difficulty: "basic" }];
      case "to_cloze": {
        const words = a.replace(/\.$/, "").split(" ");
        const key = words.sort((x, y) => y.length - x.length)[0] ?? a;
        return [{ ...base, question: quote.replace(key, `{{${key}}}`), answer: key, card_type: "cloze" }];
      }
      case "to_application":
        return [{ ...base, question: `How would you apply this idea in a real case? (${q})`, answer: a, card_type: "application" }];
      case "to_exam":
        return [{ ...base, question: `Explain in exam style: ${q}`, answer: a, card_type: "exam" }];
      case "split":
        return a
          .split(/;|, and |\. /)
          .filter((p) => p.trim().length > 8)
          .slice(0, 3)
          .map((part, k) => ({ ...base, question: `${q} (part ${k + 1})`, answer: part.trim().replace(/\.?$/, "."), card_type: "basic" as const }));
      default:
        return [{ ...base, question: q, answer: a, card_type: input.card.cardType as CandidateCard["card_type"] }];
    }
  }

  async explainAnswer(input: { question: string; answer: string; chunk: SourceChunk | null }) {
    const support = input.chunk ? sentences(input.chunk.text).filter((s) => overlap(s, input.answer) > 0.2).slice(0, 2).join(" ") : "";
    return support ? `The source states: "${support}"` : "No supporting passage was found for this answer.";
  }

  async generateQuestions(input: { chunks: SourceChunk[]; concepts: ConceptBrief[]; count: number; types: string[]; difficulty: Difficulty }): Promise<ExamQuestion[]> {
    const items = input.concepts.length
      ? input.concepts.map((c) => ({ name: c.name, summary: c.summary, chunkId: c.chunkId ?? input.chunks[0]?.id ?? "" }))
      : analyse(input.chunks).map((f) => ({ name: f.name, summary: f.summary, chunkId: f.chunkId }));
    return items.slice(0, input.count).map((c, i) => {
      const type = (input.types[i % input.types.length] ?? "explanation") as ExamQuestion["question_type"];
      const question =
        type === "compare_contrast" && items[i + 1]
          ? `Compare ${c.name} with ${items[i + 1].name}.`
          : type === "scenario"
            ? `Describe a situation where ${c.name} would matter, and explain why.`
            : `Explain ${c.name} and why it matters.`;
      return {
        question,
        question_type: type,
        model_answer: c.summary,
        key_points: normalizeText(c.summary).split(" ").filter((w) => w.length > 6).slice(0, 4),
        source_chunk_ids: [c.chunkId],
      };
    });
  }

  async evaluateAnswer(input: { question: string; modelAnswer: string; keyPoints: string[]; userAnswer: string }): Promise<Evaluation> {
    const ua = normalizeText(input.userAnswer);
    const covered = input.keyPoints.filter((k) => ua.includes(normalizeText(k)));
    const missing = input.keyPoints.filter((k) => !covered.includes(k));
    const o = overlap(input.userAnswer, input.modelAnswer);
    const completeness = input.keyPoints.length ? (covered.length / input.keyPoints.length) * 10 : o * 10;
    const accuracy = Math.min(10, 3 + o * 9);
    const terminology = Math.min(10, 2 + o * 10);
    const reasoning = Math.min(10, input.userAnswer.split(/\s+/).length > 25 ? 6 + o * 4 : 3 + o * 4);
    const overall = Math.round(((accuracy + completeness + terminology + reasoning) / 4) * 10) / 10;
    return {
      scores: { accuracy: round(accuracy), completeness: round(completeness), terminology: round(terminology), reasoning: round(reasoning) },
      overall,
      concepts_covered: covered,
      missing_concepts: missing,
      inaccuracies: [],
      suggestions: missing.length ? [`Mention: ${missing.join(", ")}.`] : ["Add an example from the material to strengthen the answer."],
      follow_up_question: `What is one limitation or consequence related to: ${input.question.replace(/[?.]$/, "")}?`,
      summary: `Mock evaluation based on word overlap with the model answer (configure an AI provider for real grading).`,
    };
  }

  async summarizeSection(chunk: SourceChunk) {
    return sentences(chunk.text).slice(0, 2).join(" ");
  }

  async *tutorStream(input: { messages: ChatMessage[]; sources: SourceChunk[] }): AsyncIterable<string> {
    const q = input.messages[input.messages.length - 1]?.content ?? "";
    const parts: string[] = ["(Mock tutor — configure an AI provider for real answers.)\n\n"];
    input.sources.slice(0, 2).forEach((s, i) => {
      const best = sentences(s.text).sort((a, b) => overlap(b, q) - overlap(a, q))[0];
      if (best) parts.push(`${best} [S${i + 1}]\n\n`);
    });
    if (parts.length === 1) parts.push("I couldn't find this in your document.");
    for (const p of parts) yield p;
  }
}

function round(n: number) {
  return Math.round(Math.max(0, Math.min(10, n)) * 10) / 10;
}
