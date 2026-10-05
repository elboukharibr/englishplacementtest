// Approximate list prices (USD per million tokens). Used for internal margin tracking only.
// Override per deployment with AI_PRICE_OVERRIDES='{"model-id":[inputPerM, outputPerM]}'.
const DEFAULT_PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
  "text-embedding-3-small": [0.02, 0],
};

let overrides: Record<string, [number, number]> | null = null;
function prices(): Record<string, [number, number]> {
  if (overrides === null) {
    try {
      overrides = process.env.AI_PRICE_OVERRIDES ? JSON.parse(process.env.AI_PRICE_OVERRIDES) : {};
    } catch {
      overrides = {};
    }
  }
  return { ...DEFAULT_PRICES, ...overrides };
}

/** Cost in micro-dollars (1e-6 USD). Unknown models count as 0 and are visible as such in admin. */
export function costMicros(model: string, tokensIn: number, tokensOut: number): number {
  const p = prices()[model];
  if (!p) return 0;
  return Math.round(tokensIn * p[0] + tokensOut * p[1]);
}
