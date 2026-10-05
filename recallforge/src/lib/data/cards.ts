import { db, toVectorLiteral } from "@/lib/db";
import { getEmbedder } from "@/lib/ai/embeddings";
import { getAI } from "@/lib/ai";
import type { CandidateCard, ImproveAction } from "@/lib/ai/schemas";
import { confidenceLabel, locateQuote } from "@/lib/pipeline/grounding";
import type { PageOffset } from "@/lib/parsing/structure";
import { UserFacingError } from "@/lib/errors";
import { truncate } from "@/lib/utils";

export async function embedCards(userId: string, cards: { id: string; question: string; answer: string }[]) {
  if (!cards.length) return;
  const vecs = await getEmbedder().embed(cards.map((c) => `${c.question} ${c.answer}`), { userId });
  for (let i = 0; i < cards.length; i++) {
    await db.$executeRawUnsafe(`UPDATE "Card" SET "embedding" = $1::vector WHERE "id" = $2`, toVectorLiteral(vecs[i]), cards[i].id);
  }
}

/**
 * Rewrites one card with AI (only that card). The rewrite is re-grounded and re-verified
 * against the same source passage before it replaces the original.
 */
export async function improveCard(userId: string, cardId: string, action: ImproveAction) {
  const card = await db.card.findFirst({ where: { id: cardId, userId }, include: { sourceSection: true } });
  if (!card) throw new UserFacingError("Card not found.", 404);
  const section = card.sourceSection;
  if (!section) throw new UserFacingError("This card has no source passage, so AI can't rewrite it safely. Edit it manually instead.", 409, "no_source");
  const ai = getAI();
  const ctx = { userId, purpose: `improve_card:${action}` };
  const chunk = { id: section.id, heading: section.path ?? section.heading, text: section.text, pageStart: section.pageStart };
  const rewritten: CandidateCard[] = (await ai.improveCard({ card: { question: card.question, answer: card.answer, cardType: card.cardType, difficulty: card.difficulty }, action, chunk }, ctx)).filter(
    (c) => c.question?.trim() && c.answer?.trim(),
  );
  if (!rewritten.length) throw new UserFacingError("The AI couldn't produce a better version of this card. Try a different option.", 422, "no_result");
  const verification = await ai.verifyCards(rewritten.map((c, i) => ({ id: String(i), question: c.question, answer: c.answer, sourceText: section.text })), ctx);

  const results = rewritten.map((c, i) => {
    const v = verification.find((r) => r.id === String(i));
    const g = locateQuote(section.text, c.supporting_quote ?? "", section.pageOffsets as PageOffset[] | null, section.pageStart);
    const conf = 0.5 * (v?.confidence ?? 0.5) + 0.3 * Math.max(0, Math.min(1, c.confidence)) + 0.2 * (g.match === "exact" ? 1 : g.match === "fuzzy" ? 0.6 : 0);
    return { c, v, g, conf: v?.verdict === "unsupported" ? Math.min(conf, 0.4) : conf };
  });
  if (results.every((r) => r.v?.verdict === "unsupported")) {
    throw new UserFacingError("The rewritten card wasn't supported by the source, so we kept your original.", 422, "unsupported");
  }
  const usable = results.filter((r) => r.v?.verdict !== "unsupported");
  const data = (r: (typeof usable)[number]) => ({
    question: truncate(r.c.question.trim(), 600),
    answer: truncate((r.v?.verdict === "partially_supported" && r.v.corrected_answer.trim()) || r.c.answer.trim(), 800),
    cardType: r.c.card_type === "cloze" && !/\{\{.+?\}\}/.test(r.c.question) ? "basic" : r.c.card_type,
    difficulty: r.c.difficulty ?? card.difficulty,
    sourceQuote: r.g.quote ?? card.sourceQuote,
    sourcePage: r.g.quote ? r.g.page : card.sourcePage,
    confidence: Math.round(r.conf * 100) / 100,
    confidenceLabel: confidenceLabel(r.conf),
    needsVerification: confidenceLabel(r.conf) === "review",
  });

  if (action === "split" && usable.length > 1) {
    const created = await db.$transaction(
      usable.map((r) =>
        db.card.create({
          data: { ...data(r), deckId: card.deckId, userId, conceptId: card.conceptId, topic: card.topic, tags: card.tags, origin: "ai", sourceSectionId: section.id, sourceHeading: card.sourceHeading, importance: card.importance },
        }),
      ),
    );
    await db.card.delete({ where: { id: card.id } });
    await embedCards(userId, created);
    return { cards: created, replaced: card.id };
  }
  // Rewriting the content resets nothing about scheduling except for substantive changes.
  const updated = await db.card.update({ where: { id: card.id }, data: data(usable[0]) });
  await embedCards(userId, [updated]);
  return { cards: [updated], replaced: null };
}
