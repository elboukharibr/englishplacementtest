import type {
  CandidateCard,
  CardType,
  Difficulty,
  Evaluation,
  ExamQuestion,
  ExtractedConcept,
  ImproveAction,
  Verification,
} from "./schemas";

export type AICallContext = { userId?: string | null; purpose: string };

export type SourceChunk = { id: string; heading: string | null; text: string; pageStart?: number | null };

export type GenerationSettings = {
  difficulty: Difficulty;
  studyGoal: "quick_revision" | "exam_preparation" | "deep_understanding" | "long_term_mastery";
  cardTypes: CardType[];
  focus: string[]; // categories the user ticked on the analysis screen
};

export type ConceptBrief = { name: string; kind: string; summary: string; importance: number; chunkId: string | null };

export type CardForVerification = { id: string; question: string; answer: string; sourceText: string };

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Task-level AI interface. Product code depends only on this, never on a vendor SDK,
 * so providers can be swapped (Anthropic, OpenAI, Gemini, a local model...).
 */
export interface AIProvider {
  readonly name: string;
  extractConcepts(chunks: SourceChunk[], ctx: AICallContext): Promise<ExtractedConcept[]>;
  generateCards(
    input: { chunks: SourceChunk[]; concepts: ConceptBrief[]; count: number; settings: GenerationSettings },
    ctx: AICallContext,
  ): Promise<CandidateCard[]>;
  verifyCards(cards: CardForVerification[], ctx: AICallContext): Promise<Verification[]>;
  improveCard(
    input: { card: { question: string; answer: string; cardType: string; difficulty: string }; action: ImproveAction; chunk: SourceChunk },
    ctx: AICallContext,
  ): Promise<CandidateCard[]>;
  explainAnswer(input: { question: string; answer: string; chunk: SourceChunk | null }, ctx: AICallContext): Promise<string>;
  generateQuestions(
    input: { chunks: SourceChunk[]; concepts: ConceptBrief[]; count: number; types: string[]; difficulty: Difficulty },
    ctx: AICallContext,
  ): Promise<ExamQuestion[]>;
  evaluateAnswer(
    input: { question: string; modelAnswer: string; keyPoints: string[]; sources: SourceChunk[]; userAnswer: string; oral: boolean },
    ctx: AICallContext,
  ): Promise<Evaluation>;
  summarizeSection(chunk: SourceChunk, ctx: AICallContext): Promise<string>;
  tutorStream(input: { messages: ChatMessage[]; sources: SourceChunk[] }, ctx: AICallContext): AsyncIterable<string>;
}

export class AIUnavailableError extends Error {
  constructor(message = "The AI service isn't configured. Add an AI provider key (see README → AI provider configuration).") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export class AIResponseError extends Error {
  constructor(message: string, public retryable = true) {
    super(message);
    this.name = "AIResponseError";
  }
}
