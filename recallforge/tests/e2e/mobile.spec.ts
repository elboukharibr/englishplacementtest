import { test, expect } from "@playwright/test";

test("mobile: sign up, try the sample deck, rate with buttons", async ({ page }) => {
  const email = `mobile+${Date.now()}@example.com`;
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Mo Bile");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("phone-study-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("radio", { name: "Professional certification" }).click();
  await page.getByRole("radio", { name: "Long-term retention" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/dashboard");

  // Bottom navigation is present on phones.
  const nav = page.getByRole("navigation", { name: "App" }).last();
  await expect(nav.getByRole("link", { name: "Review" })).toBeVisible();
  await page.getByRole("link", { name: "Study now" }).first().click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Reveal answer" }).tap();
    await page.getByRole("button", { name: /^Good:/ }).tap();
  }
  await expect(page.getByText(/Session complete|Reveal answer/).first()).toBeVisible();
  // No horizontal scrolling on the study screen.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
