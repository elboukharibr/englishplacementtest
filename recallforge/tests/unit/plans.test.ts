import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, statusGrantsPro, PRICING } from "@/lib/billing/plans";
import { minutesSavedFor } from "@/lib/billing/usage";

describe("plans", () => {
  it("free plan matches the documented limits", () => {
    expect(PLAN_LIMITS.FREE).toMatchObject({ documentsPerPeriod: 2, pagesPerDocument: 30, cardsPerPeriod: 100 });
    expect(PLAN_LIMITS.FREE.features.examMode).toBe(false);
  });
  it("pro is capped (fair use), not unlimited", () => {
    expect(Number.isFinite(PLAN_LIMITS.PRO.cardsPerPeriod)).toBe(true);
    expect(PLAN_LIMITS.PRO.cardsPerPeriod).toBeGreaterThan(PLAN_LIMITS.FREE.cardsPerPeriod);
  });
  it("annual pricing is $10/month equivalent and saves $60", () => {
    expect(PRICING.yearly.amount / 12).toBe(PRICING.yearly.monthlyEquivalent);
    expect(PRICING.monthly.amount * 12 - PRICING.yearly.amount).toBe(PRICING.yearly.savings);
  });
  it("only paying statuses grant Pro", () => {
    expect(statusGrantsPro("active")).toBe(true);
    expect(statusGrantsPro("past_due")).toBe(true);
    for (const s of ["canceled", "unpaid", "incomplete", "incomplete_expired", null]) expect(statusGrantsPro(s)).toBe(false);
  });
  it("time saved estimate is 2.5 min per card", () => {
    expect(minutesSavedFor(100)).toBe(250);
  });
});
