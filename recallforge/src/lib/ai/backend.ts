import type { z } from "zod/v4";
import type { AICallContext, ChatMessage } from "./types";

export type Tier = "strong" | "fast";

export type StructuredRequest<S extends z.ZodType> = {
  schema: S;
  schemaName: string;
  system: string;
  user: string;
  tier: Tier;
  maxTokens?: number;
};

/** Vendor-specific transport. Task logic lives in LLMProvider and is shared. */
export interface LLMBackend {
  readonly name: string;
  modelFor(tier: Tier): string;
  structured<S extends z.ZodType>(req: StructuredRequest<S>, ctx: AICallContext): Promise<z.infer<S>>;
  stream(req: { system: string; messages: ChatMessage[]; tier: Tier; maxTokens?: number }, ctx: AICallContext): AsyncIterable<string>;
}
