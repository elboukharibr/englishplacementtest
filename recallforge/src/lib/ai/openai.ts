import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod/v4";
import type { LLMBackend, StructuredRequest, Tier } from "./backend";
import type { AICallContext, ChatMessage } from "./types";
import { AIResponseError, AIUnavailableError } from "./types";
import { recordAiCall } from "./accounting";

/** Alternative backend proving the provider abstraction. Models must be set explicitly via env. */
export class OpenAIBackend implements LLMBackend {
  readonly name = "openai";
  private client: OpenAI;
  private models: Record<Tier, string>;

  constructor(opts: { apiKey?: string; strongModel?: string; fastModel?: string }) {
    if (!opts.apiKey) throw new AIUnavailableError("OPENAI_API_KEY is not set.");
    if (!opts.strongModel || !opts.fastModel) {
      throw new AIUnavailableError("Set AI_MODEL_GENERATE and AI_MODEL_FAST when AI_PROVIDER=openai.");
    }
    this.client = new OpenAI({ apiKey: opts.apiKey, maxRetries: 3 });
    this.models = { strong: opts.strongModel, fast: opts.fastModel };
  }

  modelFor(tier: Tier) {
    return this.models[tier];
  }

  async structured<S extends z.ZodType>(req: StructuredRequest<S>, ctx: AICallContext): Promise<z.infer<S>> {
    const model = this.modelFor(req.tier);
    const started = Date.now();
    try {
      const res = await this.client.chat.completions.parse({
        model,
        max_completion_tokens: req.maxTokens ?? 16000,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: zodResponseFormat(req.schema as never, req.schemaName),
      });
      await recordAiCall({
        userId: ctx.userId,
        purpose: ctx.purpose,
        provider: this.name,
        model,
        tokensIn: res.usage?.prompt_tokens ?? 0,
        tokensOut: res.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - started,
        ok: true,
      });
      const msg = res.choices[0]?.message;
      if (msg?.refusal) throw new AIResponseError("The AI model declined to process this content.", false);
      const check = req.schema.safeParse(msg?.parsed);
      if (!check.success) throw new AIResponseError("The AI returned an invalid response.");
      return check.data;
    } catch (e) {
      if (e instanceof AIResponseError) throw e;
      await recordAiCall({ userId: ctx.userId, purpose: ctx.purpose, provider: this.name, model, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - started, ok: false, error: String(e) });
      throw new AIResponseError(`The AI service is temporarily unavailable (${e instanceof Error ? e.message : e}).`);
    }
  }

  async *stream(req: { system: string; messages: ChatMessage[]; tier: Tier; maxTokens?: number }, ctx: AICallContext): AsyncIterable<string> {
    const model = this.modelFor(req.tier);
    const started = Date.now();
    const stream = await this.client.chat.completions.create({
      model,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: req.maxTokens ?? 4000,
      messages: [{ role: "system", content: req.system }, ...req.messages],
    });
    let tokensIn = 0;
    let tokensOut = 0;
    for await (const chunk of stream) {
      const d = chunk.choices[0]?.delta?.content;
      if (d) yield d;
      if (chunk.usage) {
        tokensIn = chunk.usage.prompt_tokens;
        tokensOut = chunk.usage.completion_tokens;
      }
    }
    await recordAiCall({ userId: ctx.userId, purpose: ctx.purpose, provider: this.name, model, tokensIn, tokensOut, latencyMs: Date.now() - started, ok: true });
  }
}
