// Structured-output schemas shared by every AI provider. Responses are validated
// server-side with these schemas regardless of what the provider claims to guarantee.
import { z } from "zod/v4";

export const CARD_TYPES = [
  "basic",
  "definition",
  "cloze",
  "comparison",
  "cause_effect",
  "scholar",
  "application",
  "critical",
  "scenario",
  "exam",
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const CONCEPT_KINDS = [
  "concept",
  "definition",
  "theory",
  "scholar",
  "process",
  "mechanism",
  "cause_effect",
  "comparison",
  "example",
  "date_fact",
  "formula",
  "classification",
  "controversy",
  "evidence",
  "method",
] as const;
export type ConceptKind = (typeof CONCEPT_KINDS)[number];

export const DIFFICULTIES = ["basic", "intermediate", "advanced", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const ConceptSchema = z.object({
  name: z.string().describe("Short canonical name of the concept, theory, scholar, process, etc."),
  kind: z.enum(CONCEPT_KINDS),
  summary: z.string().describe("One or two sentences, strictly supported by the source chunk."),
  importance: z.number().describe("0–100: how central this is for learning the material."),
  is_definition: z.boolean().describe("True when the source explicitly defines this term."),
  exam_relevant: z.boolean().describe("True when this is likely to be examined (central, emphasised, or explicitly flagged)."),
  chunk_id: z.string().describe("Id of the chunk where it is best explained."),
  related: z.array(z.string()).describe("Names of other concepts from this material it is directly related to."),
});
export const ConceptListSchema = z.object({ concepts: z.array(ConceptSchema) });
export type ExtractedConcept = z.infer<typeof ConceptSchema>;

export const CandidateCardSchema = z.object({
  question: z.string(),
  answer: z.string(),
  card_type: z.enum(CARD_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  concept: z.string().describe("Name of the concept this card tests."),
  source_chunk_id: z.string(),
  supporting_quote: z
    .string()
    .describe("A short verbatim excerpt (max ~40 words) copied exactly from the source chunk that supports the answer."),
  confidence: z.number().describe("0–1: how clearly the source supports this exact answer."),
  importance: z.number().describe("0–100"),
});
export const CardListSchema = z.object({ cards: z.array(CandidateCardSchema) });
export type CandidateCard = z.infer<typeof CandidateCardSchema>;

export const VerificationSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(["supported", "partially_supported", "unsupported"]),
      confidence: z.number().describe("0–1"),
      issues: z.string().describe("Empty when there are no issues."),
      corrected_answer: z.string().describe("A corrected, source-supported answer, or empty string if no correction is needed."),
    }),
  ),
});
export type Verification = z.infer<typeof VerificationSchema>["results"][number];

export const EXAM_QUESTION_TYPES = ["short_answer", "explanation", "compare_contrast", "analytical", "scenario"] as const;
export const ExamQuestionSchema = z.object({
  question: z.string(),
  question_type: z.enum(EXAM_QUESTION_TYPES),
  model_answer: z.string(),
  key_points: z.array(z.string()).describe("3–6 points a complete answer must cover."),
  source_chunk_ids: z.array(z.string()),
});
export const ExamQuestionListSchema = z.object({ questions: z.array(ExamQuestionSchema) });
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;

export const EvaluationSchema = z.object({
  scores: z.object({
    accuracy: z.number().describe("0–10 knowledge accuracy"),
    completeness: z.number().describe("0–10 conceptual completeness"),
    terminology: z.number().describe("0–10 use of correct terminology"),
    reasoning: z.number().describe("0–10 quality of reasoning"),
  }),
  overall: z.number().describe("0–10"),
  concepts_covered: z.array(z.string()),
  missing_concepts: z.array(z.string()),
  inaccuracies: z.array(z.string()),
  suggestions: z.array(z.string()),
  follow_up_question: z.string().describe("A probing follow-up an examiner would ask next."),
  summary: z.string().describe("Two or three sentences of direct feedback."),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const SummarySchema = z.object({ summary: z.string() });

export const IMPROVE_ACTIONS = [
  "easier",
  "harder",
  "shorter",
  "more_precise",
  "to_cloze",
  "to_application",
  "to_exam",
  "split",
  "explain",
  "regenerate",
] as const;
export type ImproveAction = (typeof IMPROVE_ACTIONS)[number];

export const ExplanationSchema = z.object({ explanation: z.string() });
