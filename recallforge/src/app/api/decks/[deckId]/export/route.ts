import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUser, jsonError } from "@/lib/api";
import { ownedDeck } from "@/lib/data/access";
import { toCsv, toPlainText, toQuizlet } from "@/lib/export/formats";
import { buildApkg } from "@/lib/export/apkg";
import { assertFeature } from "@/lib/billing/usage";
import { track } from "@/lib/events";

export const runtime = "nodejs";

function fileName(name: string, ext: string) {
  return `${name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 80) || "deck"}.${ext}`;
}

export const GET = withUser<{ deckId: string }>(async (req, user, { deckId }) => {
  const deck = await ownedDeck(user.id, deckId);
  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const cards = await db.card.findMany({ where: { deckId, suspended: false }, orderBy: [{ importance: "desc" }, { createdAt: "asc" }] });
  if (!cards.length) return jsonError("This deck has no cards to export.", 400, "empty_deck");
  const doc = deck.documentId ? await db.document.findUnique({ where: { id: deck.documentId }, select: { title: true } }) : null;
  const exportCards = cards.map((c) => ({ id: c.id, question: c.question, answer: c.answer, cardType: c.cardType, sourcePage: c.sourcePage, sourceHeading: c.sourceHeading, tags: c.tags, topic: c.topic }));
  let body: string | Buffer;
  let type: string;
  let ext: string;
  switch (format) {
    case "apkg":
      assertFeature(user, "ankiExport");
      body = await buildApkg({ deckId, deckName: deck.name, documentTitle: doc?.title, cards: exportCards });
      type = "application/octet-stream";
      ext = "apkg";
      break;
    case "quizlet":
      body = toQuizlet(exportCards);
      type = "text/tab-separated-values; charset=utf-8";
      ext = "txt";
      break;
    case "txt":
      body = toPlainText(exportCards, deck.name);
      type = "text/plain; charset=utf-8";
      ext = "txt";
      break;
    case "csv":
      body = toCsv(exportCards, doc?.title);
      type = "text/csv; charset=utf-8";
      ext = "csv";
      break;
    default:
      return jsonError("Unknown export format.", 400);
  }
  await track("export_used", user.id, { format, cards: cards.length });
  return new NextResponse(new Uint8Array(typeof body === "string" ? Buffer.from(body, "utf8") : body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${fileName(deck.name, ext)}"`,
      "Cache-Control": "no-store",
    },
  });
});
