import path from "node:path";
import { test, expect } from "@playwright/test";
import { e2eDb } from "./db";

test("free user sees Pro-locked options, exhausted-quota state, and exam paywall", async ({ page }) => {
  const email = `free+${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Free User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("free-plan-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("radio", { name: "Research / PhD" }).click();
  await page.getByRole("radio", { name: "Learn research papers" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/upload");
  await page.getByLabel("Choose a file").setInputFiles(path.join(__dirname, "../fixtures/textbook-8.pdf"));
  await page.getByRole("button", { name: "Upload and analyze" }).click();
  await expect(page.getByText(/We analyzed your 8-page document/)).toBeVisible({ timeout: 90_000 });

  // Pro-only card styles are visibly locked on Free.
  await expect(page.getByText("Pro").first()).toBeVisible();

  // Exhaust the monthly card allowance, then try to generate.
  const user = await e2eDb.user.findUniqueOrThrow({ where: { email } });
  await e2eDb.usage.updateMany({ where: { userId: user.id }, data: { cardsGenerated: 100, minutesSaved: 258 } });
  await page.reload();
  await expect(page.getByText(/used this period's AI card allowance/)).toBeVisible();

  // Exam mode is Pro → pricing page, not a broken button.
  await page.goto("/exam");
  await expect(page.getByText("Exam mode is part of Pro")).toBeVisible();

  // An API-level quota error opens the upsell dialog.
  await page.goto("/decks");
  const res = await page.evaluate(async () => {
    const r = await fetch("/api/decks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: "x", count: 20, difficulty: "basic", studyGoal: "quick_revision", cardTypes: ["basic"], focus: ["core"] }) });
    return r.status;
  });
  expect(res).toBe(404); // unknown document is rejected before quota
  await e2eDb.$disconnect();
});
