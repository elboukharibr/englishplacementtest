function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

export const env = {
  appUrl: optional("APP_URL") ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  sessionSecret: optional("SESSION_SECRET"),

  // AI
  aiProvider: (optional("AI_PROVIDER") ?? "anthropic") as "anthropic" | "openai" | "mock",
  anthropicKey: optional("ANTHROPIC_API_KEY"),
  openaiKey: optional("OPENAI_API_KEY"),
  modelGenerate: optional("AI_MODEL_GENERATE"),
  modelFast: optional("AI_MODEL_FAST"),
  embeddingProvider: (optional("EMBEDDING_PROVIDER") ?? "local") as "openai" | "local",

  // Infra
  storageDriver: (optional("STORAGE_DRIVER") ?? "local") as "local" | "s3",
  localStorageDir: optional("LOCAL_STORAGE_DIR") ?? ".data/uploads",
  s3: {
    bucket: optional("S3_BUCKET"),
    region: optional("S3_REGION") ?? "auto",
    endpoint: optional("S3_ENDPOINT"),
    accessKeyId: optional("S3_ACCESS_KEY_ID"),
    secretAccessKey: optional("S3_SECRET_ACCESS_KEY"),
  },
  inlineJobs: optional("INLINE_JOBS") === "true",
  cronSecret: optional("CRON_SECRET"),

  // Auth providers
  googleClientId: optional("GOOGLE_CLIENT_ID"),
  googleClientSecret: optional("GOOGLE_CLIENT_SECRET"),

  // Email
  resendKey: optional("RESEND_API_KEY"),
  emailFrom: optional("EMAIL_FROM") ?? "RecallForge <no-reply@example.com>",

  // Billing
  stripeSecret: optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
  stripePriceMonthly: optional("STRIPE_PRICE_PRO_MONTHLY"),
  stripePriceYearly: optional("STRIPE_PRICE_PRO_YEARLY"),
  // Development-only shortcut so the full upgrade flow can be exercised without Stripe keys.
  allowDevBilling: optional("ALLOW_DEV_BILLING") === "true" && process.env.NODE_ENV !== "production",

  adminEmails: (optional("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};

export const features = {
  google: () => Boolean(env.googleClientId && env.googleClientSecret),
  stripe: () => Boolean(env.stripeSecret && env.stripePriceMonthly && env.stripePriceYearly),
  email: () => Boolean(env.resendKey),
};
