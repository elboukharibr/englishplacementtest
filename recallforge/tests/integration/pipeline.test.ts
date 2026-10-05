import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { storage, storageKeyFor } from "@/lib/storage";
import { enqueue } from "@/lib/jobs/queue";
import { drainJobs } from "@/lib/jobs/runner";
import { createUser, resetDb, SAMPLE_TEXT } from "../helpers";

describe("document → analysis → deck pipeline", () => {
  beforeEach(resetDb);

  it("processes a document, ranks concepts, and generates grounded cards", async () => {
    const user = await createUser();
    const doc = await db.document.create({ data: { userId: user.id, title: "Chapter 4", filename: "ch4.txt", fileType: "txt", mimeType: "text/plain" } });
    const key = storageKeyFor(user.id, doc.id, "txt");
    await storage().put(key, Buffer.from(SAMPLE_TEXT), "text/plain");
    await db.document.update({ where: { id: doc.id }, data: { storageKey: key } });

    await enqueue("process_document", { documentId: doc.id }, { userId: user.id });
    await drainJobs("test", 30_000);

    const processed = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(processed.errorReason).toBeNull();
    expect(processed.status).toBe("READY");
    const sections = await db.documentSection.findMany({ where: { documentId: doc.id } });
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections.find((s) => s.heading === "References")?.isReferences).toBe(true);
    const concepts = await db.concept.findMany({ where: { documentId: doc.id }, orderBy: { importance: "desc" } });
    expect(concepts.map((c) => c.name)).toEqual(expect.arrayContaining(["Platformization", "Gatekeeping"]));
    const analysis = processed.analysis as { concepts: number; definitions: number };
    expect(analysis.concepts).toBe(concepts.length);
    expect(analysis.definitions).toBeGreaterThan(0);

    const deck = await db.deck.create({
      data: {
        userId: user.id,
        documentId: doc.id,
        name: "Chapter 4",
        status: "GENERATING",
        progress: 0,
        generationSettings: { count: 8, difficulty: "intermediate", studyGoal: "exam_preparation", cardTypes: ["definition", "basic", "cloze", "scholar", "cause_effect"], focus: ["core", "definitions", "scholars", "cause_effect"] },
      },
    });
    await enqueue("generate_deck", { deckId: deck.id }, { userId: user.id });
    await drainJobs("test", 30_000);

    const ready = await db.deck.findUniqueOrThrow({ where: { id: deck.id }, include: { cards: true } });
    expect(ready.statusMessage).toBeNull();
    expect(ready.status).toBe("READY");
    expect(ready.cards.length).toBeGreaterThan(2);
    for (const c of ready.cards) {
      // Every card is grounded: a real quote from a real section with a page.
      expect(c.sourceSectionId).toBeTruthy();
      expect(c.sourceQuote).toBeTruthy();
      const section = sections.find((s) => s.id === c.sourceSectionId)!;
      expect(section.text.replace(/\s+/g, " ")).toContain(c.sourceQuote!.replace(/…$/, "").replace(/\s+/g, " "));
      expect(c.confidence).not.toBeNull();
      expect(section.isReferences).toBe(false);
    }
    const usage = await db.usage.findFirstOrThrow({ where: { userId: user.id } });
    expect(usage.cardsGenerated).toBe(ready.cards.length);
    expect(usage.pages).toBeGreaterThan(0);
  });

  it("fails clearly when a free user's document exceeds the page limit", async () => {
    const user = await createUser();
    const long = Array.from({ length: 40 }, (_, i) => `## Section ${i}\n\n${"Word ".repeat(520)}`).join("\n\n");
    const doc = await db.document.create({ data: { userId: user.id, title: "Long", filename: "long.txt", fileType: "txt", mimeType: "text/plain" } });
    const key = storageKeyFor(user.id, doc.id, "txt");
    await storage().put(key, Buffer.from(long), "text/plain");
    await db.document.update({ where: { id: doc.id }, data: { storageKey: key } });
    await enqueue("process_document", { documentId: doc.id }, { userId: user.id });
    await drainJobs("test", 30_000);
    const failed = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.errorReason).toMatch(/up to 30 pages/);
    const job = await db.job.findFirstOrThrow({ where: { type: "process_document" } });
    expect(job.status).toBe("FAILED"); // not retried — permanent, user-facing problem
  });
});
