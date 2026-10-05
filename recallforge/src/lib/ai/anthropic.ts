import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import type { LLMBackend, StructuredRequest, Tier } from "./backend";
import type { AICallContext, ChatMessage } from "./types";
import { AIResponseError, AIUnavailableError } from "./types";
import { recordAiCall } from "./accounting";

// Models that accept the `effort` control and server-side refusal fallbacks.
const SUPPORTS_EFFORT = /^claude-(opus-5|opus-5-5|sonnet-5-5|fable)/;
const SUPPORTS_FALLBACK = /^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5-1)/;

export class AnthropicBackend implements LLMBackend {
  readonly name = "anthropic";
  private client: Anthropic;
  private models: Record<Tier, string>;

  constructor(opts: { apiKey?: string; strongModel?: string; fastModel?: string }) {
    if (!opts.apiKey) throw new AIUnavailableError("ANTHROPIC_API_KEY is not set.");
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 3 });
    this.models = {
      strong: opts.strongModel ?? "claude-opus-5-5",
      // Cheaper model for extraction, verification and grading (configurable).
      fast: opts.fastModel ?? "claude-haiku-4-5",
    };
  }

  modelFor(tier: Tier) {
    return this.models[tier];
  }

  private extras(model: string) {
    const extra: Record<string, unknown> = {};
    if (SUPPORTS_FALLBACK.test(model)) {
      extra.betas = ["server-side-fallback-2026-07-01"];
      extra.fallbacks = "default";
    }
    return extra;
  }

  async structured<S extends z.ZodType>(req: StructuredRequest<S>, ctx: AICallContext): Promise<z.infer<S>> {
    const model = this.modelFor(req.tier);
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      try {
        const output_config: Record<string, unknown> = { format: betaZodOutputFormat(req.schema) };
        // Extraction/grading doesn't need deep thinking; generation gets a moderate budget.
        if (SUPPORTS_EFFORT.test(model)) output_config.effort = req.tier === "strong" ? "medium" : "low";
        const res = await this.client.beta.messages.parse({
          model,
          max_tokens: req.maxTokens ?? 16000,
          system: req.system,
          messages: [
            {
              role: "user",
              content: attempt === 0 ? req.user : `${req.user}\n\n(Your previous reply did not match the required JSON schema. Reply again with valid JSON only.)`,
            },
          ],
          output_config: output_config as never,
          ...this.extras(model),
        });
        await recordAiCall({
          userId: ctx.userId,
          purpose: ctx.purpose,
          provider: this.name,
          model: res.model ?? model,
          tokensIn: (res.usage.input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0),
          tokensOut: res.usage.output_tokens ?? 0,
          latencyMs: Date.now() - started,
          ok: res.stop_reason !== "refusal" && res.parsed_output != null,
        });
        if (res.stop_reason === "refusal") {
          throw new AIResponseError("The AI model declined to process this content.", false);
        }
        if (res.stop_reason === "max_tokens") {
          lastError = "Response was cut off (max_tokens).";
          continue;
        }
        if (res.parsed_output != null) {
          // Validate again server-side — never trust the transport alone.
          const check = req.schema.safeParse(res.parsed_output);
          if (check.success) return check.data;
          lastError = check.error.message;
        } else {
          lastError = "Empty structured output.";
        }
      } catch (e) {
        if (e instanceof AIResponseError && !e.retryable) throw e;
        if (e instanceof Anthropic.AuthenticationError) throw new AIUnavailableError("The Anthropic API key was rejected.");
        if (e instanceof Anthropic.BadRequestError) {
          await recordAiCall({ userId: ctx.userId, purpose: ctx.purpose, provider: this.name, model, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - started, ok: false, error: e.message });
          throw new AIResponseError(`AI request rejected: ${e.message}`, false);
        }
        if (e instanceof Anthropic.APIError || e instanceof Anthropic.APIConnectionError) {
          await recordAiCall({ userId: ctx.userId, purpose: ctx.purpose, provider: this.name, model, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - started, ok: false, error: e.message });
          throw new AIResponseError(`The AI service is temporarily unavailable (${e.message}).`, true);
        }
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    throw new AIResponseError(`The AI returned an invalid response: ${lastError}`);
  }

  async *stream(req: { system: string; messages: ChatMessage[]; tier: Tier; maxTokens?: number }, ctx: AICallContext): AsyncIterable<string> {
    const model = this.modelFor(req.tier);
    const started = Date.now();
    const stream = this.client.beta.messages.stream({
      model,
      max_tokens: req.maxTokens ?? 4000,
      system: req.system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(SUPPORTS_EFFORT.test(model) ? { output_config: { effort: "low" as const } } : {}),
      ...this.extras(model),
    });
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      }
      const final = await stream.finalMessage();
      await recordAiCall({
        userId: ctx.userId,
        purpose: ctx.purpose,
        provider: this.name,
        model: final.model ?? model,
        tokensIn: (final.usage.input_tokens ?? 0) + (final.usage.cache_read_input_tokens ?? 0),
        tokensOut: final.usage.output_tokens ?? 0,
        latencyMs: Date.now() - started,
        ok: final.stop_reason !== "refusal",
      });
      if (final.stop_reason === "refusal") yield "\n\n(The AI model declined to answer this request.)";
    } catch (e) {
      await recordAiCall({ userId: ctx.userId, purpose: ctx.purpose, provider: this.name, model, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - started, ok: false, error: String(e) });
      throw new AIResponseError("The tutor is temporarily unavailable. Please try again.");
    }
  }
}
