import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Use a preinstalled Chromium when present (CI images, cloud sandboxes).
const chromium = process.env.PW_CHROMIUM ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const PORT = 3100;
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/recallforge_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure", launchOptions: { executablePath: chromium } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    port: PORT,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: DB,
      DIRECT_DATABASE_URL: DB,
      APP_URL: `http://localhost:${PORT}`,
      AI_PROVIDER: "mock",
      EMBEDDING_PROVIDER: "local",
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_DIR: ".data/e2e-uploads",
      INLINE_JOBS: "true",
      ALLOW_DEV_BILLING: "true",
      STRIPE_SECRET_KEY: "",
      SESSION_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef",
    },
  },
});
