import { env } from "@/lib/env";
import type { AIProvider } from "./types";
import { AIUnavailableError } from "./types";
import { LLMProvider } from "./llm-provider";
import { AnthropicBackend } from "./anthropic";
import { OpenAIBackend } from "./openai";
import { MockAIProvider } from "./mock";

let provider: AIProvider | null = null;

/** Returns the configured provider, or throws AIUnavailableError with setup guidance. */
export function getAI(): AIProvider {
  if (provider) return provider;
  switch (env.aiProvider) {
    case "mock":
      if (env.isProd && process.env.ALLOW_MOCK_AI_IN_PRODUCTION !== "true") {
        throw new AIUnavailableError("The mock AI provider is disabled in production.");
      }
      provider = new MockAIProvider();
      break;
    case "openai":
      provider = new LLMProvider(new OpenAIBackend({ apiKey: env.openaiKey, strongModel: env.modelGenerate, fastModel: env.modelFast }));
      break;
    case "anthropic":
    default:
      provider = new LLMProvider(new AnthropicBackend({ apiKey: env.anthropicKey, strongModel: env.modelGenerate, fastModel: env.modelFast }));
  }
  return provider;
}

export function aiStatus(): { configured: boolean; provider: string; isMock: boolean; message?: string } {
  try {
    const p = getAI();
    return { configured: true, provider: p.name, isMock: p.name === "mock" };
  } catch (e) {
    return { configured: false, provider: env.aiProvider, isMock: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export * from "./types";
export * from "./schemas";
