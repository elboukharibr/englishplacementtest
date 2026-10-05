import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { assertQuota, assertFeature, currentPeriod, incrementUsage, getUsage } from "@/lib/billing/usage";
import { QuotaError, NotFoundError } from "@/lib/errors";
import { ownedDeck, ownedCard, ownedSection } from "@/lib/data/access";
import { createSubjectFor } from "@/lib/data/sample";
import { MEDIA_STUDIES } from "@/lib/data/sample-content";
import { buildQueue, submitReview, startSession } from "@/lib/data/review";
import { search } from "@/lib/data/search";
import { createUser, resetDb } from "../helpers";

describe("usage limits", () => {
  beforeEach(resetDb);

  it("enforces free-plan monthly limits with an upsell payload", async () => {
    const u = await createUser();
    await incrementUsage(u.id, "cardsGenerated", 95);
    await incrementUsage(u.id, "minutesSaved", 240);
    await expect(assertQuota(u, "cards", 5)).resolves.toMatchObject({ remaining: 5 });
    const err = await assertQuota(u, "cards", 6).catch((e) => e);
    expect(err).toBeInstanceOf(QuotaError);
    expect(err.details).toMatchObject({ used: 95, limit: 100, plan: "FREE", minutesSaved: 240 });
    expect(() => assertFeature(u, "examMode")).toThrow(QuotaError);
  });

  it("uses the Stripe billing period for Pro users and the calendar month for free users", async () => {
    const u = await createUser({ plan: "PRO" });
    const start = new Date(Date.now() - 5 * 86400000);
    const end = new Date(Date.now() + 25 * 86400000);
    await db.subscription.create({ data: { userId: u.id, providerSubscriptionId: "sub_x", status: "active", currentPeriodStart: start, currentPeriodEnd: end } });
    const p = await currentPeriod(u.id);
    expect(p.start.getTime()).toBe(start.getTime());
    const f = await createUser();
    const fp = await currentPeriod(f.id);
    expect(fp.start.getUTCDate()).toBe(1);
    // A new period starts a fresh usage row (monthly reset).
    await incrementUsage(u.id, "documents", 3);
    expect((await getUsage(u.id)).documents).toBe(3);
  });
});

describe("access control", () => {
  beforeEach(resetDb);

  it("never exposes one user's decks, cards, sections or search results to another", async () => {
    const alice = await createUser({ email: "alice@example.com" });
    const bob = await createUser({ email: "bob@example.com" });
    const { deck, document } = await createSubjectFor(alice.id, MEDIA_STUDIES, { isSample: false });
    const card = await db.card.findFirstOrThrow({ where: { deckId: deck.id } });
    const section = await db.documentSection.findFirstOrThrow({ where: { documentId: document.id } });
    await expect(ownedDeck(bob.id, deck.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(ownedCard(bob.id, card.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(ownedSection(bob.id, section.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(submitReview(bob.id, { cardId: card.id, rating: 3, targetRetention: 0.9 })).rejects.toBeInstanceOf(NotFoundError);
    const bobSearch = await search(bob.id, "platformization");
    expect(bobSearch.cards.length + bobSearch.passages.length + bobSearch.concepts.length).toBe(0);
    const aliceSearch = await search(alice.id, "platformization");
    expect(aliceSearch.concepts.map((c) => c.name)).toContain("Platformization");
    expect(aliceSearch.passages.length).toBeGreaterThan(0);
  });
});

describe("card → review → scheduling", () => {
  beforeEach(resetDb);

  it("records reviews, reschedules cards and removes them from the due queue", async () => {
    const u = await createUser();
    const { deck } = await createSubjectFor(u.id, MEDIA_STUDIES, { isSample: false });
    const queue = await buildQueue(u.id, { deckIds: [deck.id], mode: "study", targetRetention: 0.9, newLimit: 5 });
    expect(queue.length).toBe(5);
    expect(queue[0].intervals[1]).toBeLessThan(queue[0].intervals[4]);
    const session = await startSession(u.id, deck.id, "study");
    const ratings = [1, 2, 3, 4, 3] as const;
    for (let i = 0; i < queue.length; i++) await submitReview(u.id, { cardId: queue[i].id, rating: ratings[i], sessionId: session.id, targetRetention: 0.9 });

    const again = await db.card.findUniqueOrThrow({ where: { id: queue[0].id } });
    const easy = await db.card.findUniqueOrThrow({ where: { id: queue[3].id } });
    expect(again.state).toBe("LEARNING");
    expect(again.due.getTime() - Date.now()).toBeLessThan(15 * 60_000);
    expect(easy.state).toBe("REVIEW");
    expect(easy.due.getTime() - Date.now()).toBeGreaterThan(2 * 86400000);
    const s = await db.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(s).toMatchObject({ cardsReviewed: 5, correct: 3 });
    expect(await db.cardReview.count({ where: { userId: u.id } })).toBe(5);

    // Later: only the remaining new cards plus nothing due yet.
    const next = await buildQueue(u.id, { deckIds: [deck.id], mode: "review", targetRetention: 0.9, newLimit: 0 });
    expect(next.length).toBe(0);
    // Forgetting a card that had graduated to review makes it weak (relearning).
    await submitReview(u.id, { cardId: easy.id, rating: 1, targetRetention: 0.9 });
    const weak = await buildQueue(u.id, { deckIds: [deck.id], mode: "weak", targetRetention: 0.9 });
    expect(weak.map((c) => c.id)).toEqual([easy.id]);
  });
});

describe("usage row concurrency", () => {
  beforeEach(resetDb);
  it("handles many concurrent first-of-period reads and increments without unique violations", async () => {
    const u = await createUser();
    await Promise.all([...Array.from({ length: 10 }, () => getUsage(u.id)), ...Array.from({ length: 10 }, () => incrementUsage(u.id, "aiRequests", 1))]);
    expect((await getUsage(u.id)).aiRequests).toBe(10);
    expect(await db.usage.count({ where: { userId: u.id } })).toBe(1);
  });
});
