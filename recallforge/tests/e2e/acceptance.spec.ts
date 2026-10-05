// Final acceptance scenario: Sarah prepares for a university exam.
// Runs against the real app with the offline mock AI provider and development billing.
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { e2eDb, fastForward } from "./db";

const email = `sarah+${Date.now()}@example.com`;
const password = "exam-season-2026";
const PDF = path.join(__dirname, "../fixtures/textbook-60.pdf");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
}

async function studyCards(page: Page, n: number, ratings: number[]) {
  for (let i = 0; i < n; i++) {
    await expect(page.getByRole("button", { name: "Reveal answer" })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("group", { name: "How well did you remember?" })).toBeVisible();
    await page.keyboard.press(String(ratings[i % ratings.length]));
  }
}

test.describe.serial("Sarah's exam preparation", () => {
  test.afterAll(async () => e2eDb.$disconnect());

  test("full journey from landing page to Pro", async ({ page }) => {
    test.setTimeout(420_000);

    // 1. Homepage — understood at a glance.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Turn textbooks into mastery." })).toBeVisible();
    await page.getByRole("link", { name: /Create your first deck/ }).click();

    // 2. Register.
    await page.waitForURL("**/signup");
    await page.getByLabel("Name").fill("Sarah Martin");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    // 3–4. Onboarding: exam preparation + exam date.
    await page.waitForURL("**/onboarding");
    await page.getByRole("radio", { name: "University course" }).click();
    await page.getByRole("radio", { name: "Prepare for an exam" }).click();
    const examDate = new Date(Date.now() + 27 * 86400000).toISOString().slice(0, 10);
    await page.getByLabel(/When is your exam/).fill(examDate);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByText(/Exam in 2[67] days/)).toBeVisible();
    await expect(page.getByText("Sample Deck — Platforms and Media Power").first()).toBeVisible();

    // 5–6. Upload a 60-page PDF and watch processing. On the free plan this hits the 30-page limit (step 20).
    await page.goto("/upload");
    await page.getByLabel("Choose a file").setInputFiles(PDF);
    await page.getByRole("button", { name: "Upload and analyze" }).click();
    await page.waitForURL(/\/library\/[^/]+$/);
    const docUrl = page.url();
    await expect(page.getByText("We couldn't process this document.")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/This document has 60 pages\. The Free plan supports up to 30 pages/)).toBeVisible();

    // 21–22. Upgrade to Pro and see Pro status immediately.
    await page.goto("/pricing");
    await page.getByRole("radio", { name: /Monthly/ }).click();
    await page.getByRole("button", { name: "Start Pro" }).click();
    await page.waitForURL("**/settings/billing?checkout=success");
    await expect(page.getByText("Welcome to Pro")).toBeVisible();
    await expect(page.getByText("Current plan").locator("..").getByText("Pro", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Upgrade to Pro" })).toHaveCount(0);

    // 6–7. Retry processing, now allowed; see the document analysis.
    await page.goto(docUrl);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText(/We analyzed your 60-page document/)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Estimated time saved")).toBeVisible();

    // 8. Request 80 advanced cards.
    await page.getByRole("radio", { name: /Comprehensive/ }).click();
    await page.getByLabel("Difficulty").selectOption("advanced");
    await page.getByRole("button", { name: "Generate study deck" }).click();
    await page.waitForURL(/\/decks\/[^/]+$/);
    const deckUrl = page.url();
    const deckId = deckUrl.split("/").pop()!;

    // 9. Review generated cards.
    await expect(page.getByText("Your deck is ready")).toBeVisible({ timeout: 120_000 });
    const deck = await e2eDb.deck.findUniqueOrThrow({ where: { id: deckId }, include: { cards: true } });
    expect(deck.cards.length).toBeGreaterThanOrEqual(25);
    for (const c of deck.cards) {
      expect(c.sourceQuote).toBeTruthy();
      expect(c.sourcePage).not.toBeNull();
    }
    await page.getByRole("tab", { name: /^All/ }).click();

    // 10. Edit one card.
    const firstCard = page.locator("li").filter({ has: page.getByRole("button", { name: "Edit card" }) }).first();
    await firstCard.getByRole("button", { name: "Edit card" }).click();
    await page.getByLabel("Answer").fill("Edited by Sarah: a concise answer in her own words.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Edited by Sarah: a concise answer in her own words.")).toBeVisible();

    // 11. Delete one weak card.
    const before = await e2eDb.card.count({ where: { deckId } });
    await page.locator("li").filter({ has: page.getByRole("button", { name: "Delete card" }) }).nth(1).getByRole("button", { name: "Delete card" }).click();
    await expect.poll(() => e2eDb.card.count({ where: { deckId } })).toBe(before - 1);

    // View source with highlighted passage.
    await page.getByRole("button", { name: "View source" }).first().click();
    await expect(page.locator("mark.source-highlight")).toBeVisible();
    await page.keyboard.press("Escape");

    // 12–14. Study session: 20 cards with a mix of ratings (keyboard shortcuts).
    await page.getByRole("link", { name: /Study now/ }).first().click();
    await page.waitForURL(`**/study/${deckId}`);
    await studyCards(page, 20, [1, 2, 3, 4, 3]);
    await expect.poll(() => e2eDb.cardReview.count({ where: { card: { deckId } } })).toBe(20);
    const learning = await e2eDb.card.count({ where: { deckId, state: { in: ["LEARNING", "RELEARNING"] } } });
    const review = await e2eDb.card.count({ where: { deckId, state: "REVIEW" } });
    expect(learning).toBeGreaterThan(0);
    expect(review).toBeGreaterThan(0);

    // 15. Leave.
    await page.getByRole("link", { name: "End session" }).click();
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await page.waitForURL((u) => u.pathname === "/");

    // Time passes…
    await fastForward(email);

    // 16–17. Log back in; scheduled cards are due.
    await login(page);
    await expect(page.getByRole("link", { name: "Start review" })).toBeVisible();
    await page.goto("/review");
    await expect(page.getByText("Cards due")).toBeVisible();
    await page.getByRole("link", { name: "Review all" }).click();
    await studyCards(page, 6, [1, 1, 3, 1, 3, 1]);
    await page.getByRole("link", { name: "End session" }).click();

    // 18. Weak concepts.
    await page.goto("/review");
    await expect(page.getByRole("link", { name: "Practice weak topics" })).toBeVisible();
    await page.getByRole("link", { name: "Practice weak topics" }).click();
    await expect(page.getByRole("button", { name: "Reveal answer" })).toBeVisible();
    await page.getByRole("link", { name: "End session" }).click();

    // 19. Export (Anki package and CSV).
    await page.goto(deckUrl);
    await page.getByRole("button", { name: "Export" }).click();
    const apkg = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /Anki package/ }).click();
    expect((await apkg).suggestedFilename()).toMatch(/\.apkg$/);
    await page.getByRole("button", { name: "Export" }).click();
    const csv = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /CSV/ }).click();
    expect((await csv).suggestedFilename()).toMatch(/\.csv$/);

    // 23. Continue generating cards as Pro.
    await page.goto(docUrl);
    await page.getByRole("radio", { name: /Essential/ }).click();
    await page.getByRole("button", { name: "Generate study deck" }).click();
    await page.waitForURL(/\/decks\/[^/]+$/);
    await expect(page.getByText("Your deck is ready")).toBeVisible({ timeout: 120_000 });

    // Analytics & study plan reflect the work (sample deck excluded).
    await page.goto("/analytics");
    await expect(page.getByText("Total reviews")).toBeVisible();
    await page.goto("/study-plan");
    await expect(page.getByText(/Exam in/).first()).toBeVisible();
  });
});
