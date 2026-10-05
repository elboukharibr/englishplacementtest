import { db } from "@/lib/db";
import { withUser, ok, jsonError } from "@/lib/api";
import { parseCardFile } from "@/lib/export/import";
import { sanitizeFilename } from "@/lib/parsing";
import { embedCards } from "@/lib/data/cards";

export const POST = withUser(async (req, user) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError("No file was received.", 400);
  if (file.size > 5 * 1024 * 1024) return jsonError("Import files are limited to 5 MB.", 413);
  const name = sanitizeFilename(file.name);
  if (!/\.(csv|tsv|txt)$/i.test(name)) return jsonError("Import a .csv or .tsv file (Anki package import is coming soon).", 415);
  const text = await file.text();
  if (text.includes("\u0000")) return jsonError("This doesn't look like a text file.", 415);
  const { cards, skipped } = parseCardFile(text, name);
  if (!cards.length) return jsonError("No cards found. Each row needs a front and a back column.", 422);
  const deckName = String(form?.get("name") ?? "").trim() || name.replace(/\.[^.]+$/, "");
  const deck = await db.deck.create({ data: { userId: user.id, name: deckName.slice(0, 160), status: "READY", tags: ["imported"] } });
  await db.card.createMany({ data: cards.map((c) => ({ deckId: deck.id, userId: user.id, question: c.question, answer: c.answer, tags: c.tags, origin: "import", importance: 50 })) });
  const created = await db.card.findMany({ where: { deckId: deck.id }, select: { id: true, question: true, answer: true } });
  await embedCards(user.id, created);
  return ok({ id: deck.id, imported: cards.length, skipped }, { status: 201 });
});
