import type { LLMBackend } from "./backend";
import type { AICallContext, AIProvider, CardForVerification, ChatMessage, ConceptBrief, GenerationSettings, SourceChunk } from "./types";
import {
  CardListSchema,
  ConceptListSchema,
  EvaluationSchema,
  ExamQuestionListSchema,
  ExplanationSchema,
  SummarySchema,
  VerificationSchema,
  type CandidateCard,
  type Difficulty,
  type ImproveAction,
} from "./schemas";
import {
  CARD_GENERATION_SYSTEM,
  CONCEPT_EXTRACTION_SYSTEM,
  EVALUATION_SYSTEM,
  EXAM_QUESTION_SYSTEM,
  IMPROVE_SYSTEM,
  SUMMARY_SYSTEM,
  TUTOR_SYSTEM,
  VERIFICATION_SYSTEM,
} from "./prompts";

function renderChunks(chunks: SourceChunk[]): string {
  return chunks
    .map((c) => `<chunk id="${c.id}"${c.heading ? ` heading="${escapeAttr(c.heading)}"` : ""}${c.pageStart ? ` page="${c.pageStart}"` : ""}>\n${c.text}\n</chunk>`)
    .join("\n\n");
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "'").slice(0, 200);
}

const GOAL_GUIDANCE: Record<GenerationSettings["studyGoal"], string> = {
  quick_revision: "Favour the most essential facts and definitions; keep answers very short.",
  exam_preparation: "Favour what is most likely to be examined: definitions, distinctions, mechanisms, key authors, evidence.",
  deep_understanding: "Favour why/how questions, mechanisms, causal links and conceptual distinctions over isolated facts.",
  long_term_mastery: "Balance foundational facts with relational and application questions that build durable understanding.",
};

const DIFFICULTY_GUIDANCE: Record<Difficulty, string> = {
  basic: "Basic: direct recall of definitions and key facts.",
  intermediate: "Intermediate: recall plus explanation of relationships and mechanisms.",
  advanced: "Advanced: distinctions, causal reasoning, application to new situations, and critique.",
  expert: "Expert: nuanced distinctions, limitations, controversies, synthesis across sections and scenario-based reasoning.",
};

const ACTION_GUIDANCE: Record<ImproveAction, string> = {
  easier: "Make the card easier: more direct question, simpler wording, same core idea.",
  harder: "Make the card harder: require deeper reasoning (why/how, distinction, application) about the same idea.",
  shorter: "Make the question and especially the answer shorter while staying correct.",
  more_precise: "Make the question unambiguous and the answer more precise, using the source's exact terminology.",
  to_cloze: "Turn it into a cloze card (sentence with the key term in {{double braces}}; answer = the hidden term).",
  to_application: "Turn it into an application question that applies the idea to a concrete situation supported by the source.",
  to_exam: "Turn it into an exam-style question with a concise model answer.",
  split: "Split this card into 2–4 atomic cards, each testing one idea.",
  explain: "Keep the card; rewrite the answer to include a one-sentence explanation of why it is true.",
  regenerate: "Write a better card about the same idea, following all quality rules.",
};

export class LLMProvider implements AIProvider {
  readonly name: string;
  constructor(private backend: LLMBackend) {
    this.name = backend.name;
  }

  async extractConcepts(chunks: SourceChunk[], ctx: AICallContext) {
    const res = await this.backend.structured(
      {
        schema: ConceptListSchema,
        schemaName: "concepts",
        system: CONCEPT_EXTRACTION_SYSTEM,
        user: `Source chunks:\n\n${renderChunks(chunks)}\n\nList the important items. Use the chunk ids given above for chunk_id.`,
        tier: "fast",
        maxTokens: 8000,
      },
      ctx,
    );
    return res.concepts;
  }

  async generateCards(input: { chunks: SourceChunk[]; concepts: ConceptBrief[]; count: number; settings: GenerationSettings }, ctx: AICallContext) {
    const { settings } = input;
    const conceptList = input.concepts
      .map((c) => `- ${c.name} [${c.kind}, importance ${c.importance}${c.chunkId ? `, chunk ${c.chunkId}` : ""}]: ${c.summary}`)
      .join("\n");
    const user = `Create ${input.count} study cards from the source below.

Learner settings:
- ${DIFFICULTY_GUIDANCE[settings.difficulty]}
- Goal: ${GOAL_GUIDANCE[settings.studyGoal]}
- Allowed card types: ${settings.cardTypes.join(", ")}. Use a mix that suits the content.
- Focus areas the learner asked for: ${settings.focus.join(", ") || "all important content"}.

Priority concepts (cover the most important first; more cards for higher importance):
${conceptList || "(none listed — identify them yourself)"}

Source chunks:
${renderChunks(input.chunks)}

Use the chunk ids above for source_chunk_id. Return exactly ${input.count} cards if the source supports that many good cards; otherwise return fewer rather than padding with weak cards.`;
    const res = await this.backend.structured(
      { schema: CardListSchema, schemaName: "cards", system: CARD_GENERATION_SYSTEM, user, tier: "strong", maxTokens: Math.min(32000, 2500 + input.count * 400) },
      ctx,
    );
    return res.cards;
  }

  async verifyCards(cards: CardForVerification[], ctx: AICallContext) {
    if (!cards.length) return [];
    // Each distinct source passage is sent once; cards reference it by id (cuts input tokens sharply).
    const sources = new Map<string, string>();
    const sourceIdFor = (text: string) => {
      for (const [id, t] of sources) if (t === text) return id;
      const id = `src${sources.size + 1}`;
      sources.set(id, text);
      return id;
    };
    const cardBlock = cards
      .map((c) => `<card id="${c.id}" source="${sourceIdFor(c.sourceText)}">\nQ: ${c.question}\nA: ${c.answer}\n</card>`)
      .join("\n");
    const sourceBlock = [...sources].map(([id, t]) => `<source id="${id}">\n${t}\n</source>`).join("\n\n");
    const res = await this.backend.structured(
      {
        schema: VerificationSchema,
        schemaName: "verification",
        system: VERIFICATION_SYSTEM,
        user: `Sources:\n${sourceBlock}\n\nCheck each card only against the source it references.\n\n${cardBlock}`,
        tier: "fast",
        maxTokens: 6000,
      },
      ctx,
    );
    return res.results;
  }

  async improveCard(
    input: { card: { question: string; answer: string; cardType: string; difficulty: string }; action: ImproveAction; chunk: SourceChunk },
    ctx: AICallContext,
  ): Promise<CandidateCard[]> {
    const user = `Requested change: ${ACTION_GUIDANCE[input.action]}

Current card:
Type: ${input.card.cardType} · Difficulty: ${input.card.difficulty}
Q: ${input.card.question}
A: ${input.card.answer}

Source chunk:
${renderChunks([input.chunk])}`;
    const res = await this.backend.structured(
      { schema: CardListSchema, schemaName: "cards", system: IMPROVE_SYSTEM, user, tier: "strong", maxTokens: 4000 },
      ctx,
    );
    return res.cards;
  }

  async explainAnswer(input: { question: string; answer: string; chunk: SourceChunk | null }, ctx: AICallContext) {
    const res = await this.backend.structured(
      {
        schema: ExplanationSchema,
        schemaName: "explanation",
        system: `${TUTOR_SYSTEM}\nExplain briefly (3–5 sentences) why the answer is correct, using the source.`,
        user: `Q: ${input.question}\nA: ${input.answer}\n\n${input.chunk ? renderChunks([input.chunk]) : "(no source available)"}`,
        tier: "fast",
        maxTokens: 1500,
      },
      ctx,
    );
    return res.explanation;
  }

  async generateQuestions(
    input: { chunks: SourceChunk[]; concepts: ConceptBrief[]; count: number; types: string[]; difficulty: Difficulty },
    ctx: AICallContext,
  ) {
    const user = `Write ${input.count} exam questions. Allowed question types: ${input.types.join(", ")}.
${DIFFICULTY_GUIDANCE[input.difficulty]}

Key concepts:
${input.concepts.map((c) => `- ${c.name}: ${c.summary}`).join("\n")}

Sources:
${renderChunks(input.chunks)}`;
    const res = await this.backend.structured(
      { schema: ExamQuestionListSchema, schemaName: "questions", system: EXAM_QUESTION_SYSTEM, user, tier: "strong", maxTokens: 8000 },
      ctx,
    );
    return res.questions;
  }

  async evaluateAnswer(
    input: { question: string; modelAnswer: string; keyPoints: string[]; sources: SourceChunk[]; userAnswer: string; oral: boolean },
    ctx: AICallContext,
  ) {
    const user = `Question: ${input.question}

Model answer: ${input.modelAnswer}
Key points: ${input.keyPoints.map((k) => `\n- ${k}`).join("")}

Learner's ${input.oral ? "spoken (transcribed — ignore filler words and minor transcription errors)" : "written"} answer:
"""${input.userAnswer}"""

Sources:
${renderChunks(input.sources)}`;
    return this.backend.structured(
      { schema: EvaluationSchema, schemaName: "evaluation", system: EVALUATION_SYSTEM, user, tier: "fast", maxTokens: 3000 },
      ctx,
    );
  }

  async summarizeSection(chunk: SourceChunk, ctx: AICallContext) {
    const res = await this.backend.structured(
      { schema: SummarySchema, schemaName: "summary", system: SUMMARY_SYSTEM, user: renderChunks([chunk]), tier: "fast", maxTokens: 800 },
      ctx,
    );
    return res.summary;
  }

  tutorStream(input: { messages: ChatMessage[]; sources: SourceChunk[] }, ctx: AICallContext) {
    const sourceBlock = input.sources
      .map((s, i) => `[S${i + 1}] ${s.heading ?? "Untitled section"}${s.pageStart ? ` (p. ${s.pageStart})` : ""}\n${s.text}`)
      .join("\n\n");
    const messages = [...input.messages];
    const last = messages.pop()!;
    messages.push({ role: "user", content: `Source excerpts from my material:\n\n${sourceBlock || "(no relevant excerpts found)"}\n\n---\n\n${last.content}` });
    return this.backend.stream({ system: TUTOR_SYSTEM, messages, tier: "strong", maxTokens: 3000 }, ctx);
  }
}
