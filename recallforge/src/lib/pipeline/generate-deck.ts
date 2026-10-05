// Deck generation with hallucination control:
//   1. select high-importance concepts   2. generate candidate cards per source batch (strong model)
//   3. locate each supporting quote in the real text (local, exact/fuzzy) → page number
//   4. semantic de-duplication (embeddings)   5. independent verification against the source (cheap model)
//   6. combine signals into a confidence score; reject unsupported, flag uncertain.
import type { DocumentSection } from "@prisma/client";
import { db, toVectorLiteral } from "@/lib/db";
import { getAI } from "@/lib/ai";
import type { GenerationSettings } from "@/lib/ai/types";
import type { CandidateCard, CardType, Difficulty } from "@/lib/ai/schemas";
import { cosine, getEmbedder } from "@/lib/ai/embeddings";
import { getUsage, incrementUsage, minutesSavedFor } from "@/lib/billing/usage";
import { limitsFor } from "@/lib/billing/plans";
import { PermanentJobError, UserFacingError } from "@/lib/errors";
import { track } from "@/lib/events";
import { notify } from "@/lib/notifications";
import { normalizeText, truncate } from "@/lib/utils";
import type { PageOffset } from "@/lib/parsing/structure";
import { confidenceLabel, locateQuote } from "./grounding";
import { kindsForFocus } from "./focus";
import { batchByWeight, mapLimit } from "./util";
import { userMessageFor } from "./process-document";

export type DeckGenerationSettings = {
  count: number;
  difficulty: Difficulty;
  studyGoal: GenerationSettings["studyGoal"];
  cardTypes: CardType[];
  focus: string[];
};

export type GenerationReport = {
  requested: number;
  candidates: number;
  rejectedUnsupported: number;
  rejectedUngrounded: number;
  removedDuplicates: number;
  flagged: number;
  saved: number;
  durationMs: number;
};

type Candidate = CandidateCard & {
  key: string;
  section: DocumentSection;
  quote: string | null;
  quoteMatch: "exact" | "fuzzy" | "none";
  page: number | null;
  verdict?: "supported" | "partially_supported" | "unsupported";
  verifierConfidence?: number;
  issues?: string;
  finalConfidence?: number;
  embedding?: number[];
  conceptId?: string | null;
};

async function progress(deckId: string, p: number, msg: string) {
  await db.deck.update({ where: { id: deckId }, data: { progress: p, statusMessage: msg } });
}

export async function generateDeck(deckId: string) {
  const started = Date.now();
  const deck = await db.deck.findUnique({ where: { id: deckId }, include: { user: true } });
  if (!deck || !deck.documentId) throw new PermanentJobError("Deck or source document missing.");
  if (deck.status === "READY") return;
  // A retried job starts from a clean slate so cards are never duplicated.
  await db.card.deleteMany({ where: { deckId, origin: "ai", reps: 0 } });
  const settings = deck.generationSettings as unknown as DeckGenerationSettings;
  const limits = limitsFor(deck.user.plan);
  const usage = await getUsage(deck.userId);
  const remaining = limits.cardsPerPeriod - usage.cardsGenerated;
  if (remaining <= 0) throw new UserFacingError("You've reached your monthly AI card limit.", 402, "cards");
  const target = Math.min(settings.count, remaining, limits.maxCardsPerDeck);

  await progress(deckId, 5, "Selecting high-value concepts…");
  const [sections, concepts] = await Promise.all([
    db.documentSection.findMany({ where: { documentId: deck.documentId, isReferences: false }, orderBy: { order: "asc" } }),
    db.concept.findMany({ where: { documentId: deck.documentId }, orderBy: { importance: "desc" } }),
  ]);
  if (!sections.length) throw new UserFacingError("This document has no study-worthy text to generate cards from.");
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  // Concept selection by the learner's focus choices.
  const kinds = kindsForFocus(settings.focus);
  let selected = concepts.filter((c) => kinds.has(c.kind) || (settings.focus.includes("exam") && c.examRelevant));
  if (selected.length < Math.min(5, concepts.length)) selected = concepts;

  // Rank sections by the importance of the concepts they hold; allocate cards proportionally.
  const weight = new Map<string, number>();
  for (const c of selected) if (c.sectionId) weight.set(c.sectionId, (weight.get(c.sectionId) ?? 0) + c.importance);
  let ranked = sections.filter((s) => weight.has(s.id)).sort((a, b) => (weight.get(b.id) ?? 0) - (weight.get(a.id) ?? 0));
  if (!ranked.length) ranked = sections; // no concepts detected — fall back to all text
  // Cost control: only send as much text as the deck size justifies (≈ 450 tokens of source per card, min 4k).
  const tokenBudget = Math.max(4000, target * 450);
  const chosen: DocumentSection[] = [];
  let used = 0;
  for (const s of ranked) {
    if (used > tokenBudget) break;
    chosen.push(s);
    used += s.tokenCount;
  }
  chosen.sort((a, b) => a.order - b.order);
  const batches = batchByWeight(chosen, (s) => s.tokenCount, 5000);
  const totalWeight = chosen.reduce((n, s) => n + (weight.get(s.id) ?? 1), 0) || 1;
  const overgenerate = Math.ceil(target * 1.3);

  const ai = getAI();
  const genSettings: GenerationSettings = { difficulty: settings.difficulty, studyGoal: settings.studyGoal, cardTypes: settings.cardTypes, focus: settings.focus };
  let done = 0;
  await progress(deckId, 10, "Writing candidate cards…");
  const raw = await mapLimit(batches, 3, async (batch) => {
    const bw = batch.reduce((n, s) => n + (weight.get(s.id) ?? 1), 0);
    const n = Math.max(2, Math.round((bw / totalWeight) * overgenerate));
    const ids = new Set(batch.map((s) => s.id));
    const batchConcepts = selected.filter((c) => c.sectionId && ids.has(c.sectionId)).slice(0, 40);
    const cards = await ai.generateCards(
      {
        chunks: batch.map((s) => ({ id: s.id, heading: s.path ?? s.heading, text: s.text, pageStart: s.pageStart })),
        concepts: batchConcepts.map((c) => ({ name: c.name, kind: c.kind, summary: c.summary, importance: c.importance, chunkId: c.sectionId })),
        count: n,
        settings: genSettings,
      },
      { userId: deck.userId, purpose: "generate_cards" },
    );
    done++;
    await progress(deckId, 10 + Math.round((done / batches.length) * 50), `Writing candidate cards… (${done}/${batches.length})`);
    return cards.map((c) => ({ card: c, batch }));
  });

  // ── Grounding: every card must point at real text ──
  await progress(deckId, 62, "Checking every card against your source…");
  const conceptByKey = new Map(concepts.map((c) => [normalizeText(c.name), c.id]));
  const candidates: Candidate[] = [];
  let rejectedUngrounded = 0;
  for (const { card, batch } of raw.flat()) {
    if (!card.question?.trim() || !card.answer?.trim()) continue;
    if (!settings.cardTypes.includes(card.card_type)) card.card_type = settings.cardTypes[0] ?? "basic";
    if (card.card_type === "cloze" && !/\{\{.+?\}\}/.test(card.question)) card.card_type = "basic";
    let section = sectionById.get(card.source_chunk_id);
    if (!section || !batch.some((b) => b.id === section!.id)) section = batch[0];
    let g = locateQuote(section.text, card.supporting_quote ?? "", section.pageOffsets as PageOffset[] | null, section.pageStart);
    if (g.match === "none") {
      // The model may have cited the wrong chunk id within the batch.
      for (const other of batch) {
        const alt = locateQuote(other.text, card.supporting_quote ?? "", other.pageOffsets as PageOffset[] | null, other.pageStart);
        if (alt.match !== "none") {
          section = other;
          g = alt;
          break;
        }
      }
    }
    if (g.match === "none") {
      rejectedUngrounded++;
      continue;
    }
    candidates.push({
      ...card,
      question: card.question.trim(),
      answer: card.answer.trim(),
      key: `c${candidates.length}`,
      section,
      quote: g.quote,
      quoteMatch: g.match,
      page: g.page,
      conceptId: conceptByKey.get(normalizeText(card.concept)) ?? null,
      importance: Math.max(0, Math.min(100, Math.round(card.importance))),
      confidence: Math.max(0, Math.min(1, card.confidence)),
    });
  }

  // ── Semantic de-duplication ──
  await progress(deckId, 70, "Removing duplicates…");
  const embedder = getEmbedder();
  const vecs = await embedder.embed(candidates.map((c) => `${c.question} ${c.card_type === "cloze" ? "" : c.answer}`), { userId: deck.userId });
  candidates.forEach((c, i) => (c.embedding = vecs[i]));
  const threshold = embedder.name.startsWith("local") ? 0.8 : 0.9;
  candidates.sort((a, b) => b.importance * b.confidence - a.importance * a.confidence);
  const kept: Candidate[] = [];
  const seenQ = new Set<string>();
  let removedDuplicates = 0;
  for (const c of candidates) {
    const nq = normalizeText(c.question);
    if (seenQ.has(nq) || kept.some((k) => cosine(k.embedding!, c.embedding!) >= threshold)) {
      removedDuplicates++;
      continue;
    }
    seenQ.add(nq);
    kept.push(c);
  }

  // ── Independent verification ──
  await progress(deckId, 76, "Verifying answers against the source…");
  const pool = kept.slice(0, Math.ceil(target * 1.15));
  const vBatches: Candidate[][] = [];
  for (let i = 0; i < pool.length; i += 10) vBatches.push(pool.slice(i, i + 10));
  let vDone = 0;
  await mapLimit(vBatches, 3, async (b) => {
    const results = await ai.verifyCards(
      b.map((c) => ({ id: c.key, question: c.question, answer: c.answer, sourceText: c.section.text })),
      { userId: deck.userId, purpose: "verify_cards" },
    );
    for (const r of results) {
      const c = b.find((x) => x.key === r.id);
      if (!c) continue;
      c.verdict = r.verdict;
      c.verifierConfidence = Math.max(0, Math.min(1, r.confidence));
      c.issues = r.issues;
      if (r.verdict === "partially_supported" && r.corrected_answer.trim()) c.answer = r.corrected_answer.trim();
    }
    vDone++;
    await progress(deckId, 76 + Math.round((vDone / vBatches.length) * 16), "Verifying answers against the source…");
  });

  let rejectedUnsupported = 0;
  const final: Candidate[] = [];
  for (const c of pool) {
    if (c.verdict === "unsupported") {
      rejectedUnsupported++;
      continue;
    }
    const verifier = c.verifierConfidence ?? 0.5; // not verified (should not happen) → neutral
    const quoteScore = c.quoteMatch === "exact" ? 1 : 0.6;
    let conf = 0.5 * verifier + 0.3 * c.confidence + 0.2 * quoteScore;
    if (c.verdict === "partially_supported") conf = Math.min(conf, 0.65);
    c.finalConfidence = Math.round(conf * 100) / 100;
    final.push(c);
  }
  const chosenCards = final.slice(0, target);

  // ── Persist ──
  await progress(deckId, 94, "Saving your deck…");
  const created = await db.$transaction(
    chosenCards.map((c) => {
      const label = confidenceLabel(c.finalConfidence!);
      return db.card.create({
        data: {
          deckId,
          userId: deck.userId,
          conceptId: c.conceptId,
          question: truncate(c.question, 600),
          answer: truncate(c.answer, 800),
          cardType: c.card_type,
          difficulty: c.difficulty ?? settings.difficulty,
          topic: c.concept?.slice(0, 120) || c.section.heading,
          origin: "ai",
          sourceSectionId: c.section.id,
          sourceQuote: c.quote,
          sourcePage: c.page,
          sourceHeading: c.section.path ?? c.section.heading,
          confidence: c.finalConfidence,
          confidenceLabel: label,
          needsVerification: label === "review",
          importance: c.importance,
        },
        select: { id: true },
      });
    }),
  );
  for (let i = 0; i < created.length; i++) {
    const emb = chosenCards[i].embedding;
    if (emb) await db.$executeRawUnsafe(`UPDATE "Card" SET "embedding" = $1::vector WHERE "id" = $2`, toVectorLiteral(emb), created[i].id);
  }

  const report: GenerationReport = {
    requested: settings.count,
    candidates: raw.flat().length,
    rejectedUnsupported,
    rejectedUngrounded,
    removedDuplicates,
    flagged: chosenCards.filter((c) => confidenceLabel(c.finalConfidence!) === "review").length,
    saved: created.length,
    durationMs: Date.now() - started,
  };
  if (!created.length) {
    throw new UserFacingError("We couldn't generate cards we were confident in from this document. Try a different focus or a text-richer document.");
  }
  await db.deck.update({ where: { id: deckId }, data: { status: "READY", progress: 100, statusMessage: null, generationReport: report } });
  await incrementUsage(deck.userId, "cardsGenerated", created.length);
  await incrementUsage(deck.userId, "minutesSaved", minutesSavedFor(created.length));
  await track("deck_generated", deck.userId, { cards: created.length, requested: settings.count, flagged: report.flagged, ms: report.durationMs });
  await notify(deck.userId, { kind: "system", title: `Your deck “${deck.name}” is ready`, body: `${created.length} cards generated.`, href: `/decks/${deckId}`, dedupeKey: `deck-ready-${deckId}` });
}

export async function markDeckFailed(deckId: string, e: unknown) {
  await db.deck.update({ where: { id: deckId }, data: { status: "FAILED", statusMessage: userMessageFor(e) } }).catch(() => {});
}

export async function markDeckRetrying(deckId: string, e: unknown) {
  await db.deck
    .update({ where: { id: deckId }, data: { statusMessage: `Temporary problem — retrying automatically (${userMessageFor(e).slice(0, 120)})` } })
    .catch(() => {});
}
