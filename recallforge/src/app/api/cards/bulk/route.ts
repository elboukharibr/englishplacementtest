import { z } from "zod/v4";
import { db } from "@/lib/db";
import { withUser, ok, parseBody } from "@/lib/api";
import { CARD_TYPES, DIFFICULTIES } from "@/lib/ai/schemas";

const Body = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum(["delete", "verify", "suspend", "unsuspend", "difficulty", "type", "move"]),
  difficulty: z.enum(DIFFICULTIES).optional(),
  cardType: z.enum(CARD_TYPES).optional(),
  deckId: z.string().optional(),
});

export const POST = withUser(async (req, user) => {
  const b = await parseBody(req, Body);
  const where = { id: { in: b.ids }, userId: user.id };
  let count = 0;
  switch (b.action) {
    case "delete":
      count = (await db.card.deleteMany({ where })).count;
      break;
    case "verify":
      count = (await db.card.updateMany({ where, data: { needsVerification: false } })).count;
      break;
    case "suspend":
    case "unsuspend":
      count = (await db.card.updateMany({ where, data: { suspended: b.action === "suspend" } })).count;
      break;
    case "difficulty":
      if (b.difficulty) count = (await db.card.updateMany({ where, data: { difficulty: b.difficulty } })).count;
      break;
    case "type":
      // Cloze needs {{…}} markup, so it can't be bulk-applied.
      if (b.cardType && b.cardType !== "cloze") count = (await db.card.updateMany({ where, data: { cardType: b.cardType } })).count;
      break;
    case "move": {
      const target = b.deckId ? await db.deck.findFirst({ where: { id: b.deckId, userId: user.id } }) : null;
      if (target) count = (await db.card.updateMany({ where, data: { deckId: target.id } })).count;
      break;
    }
  }
  return ok({ count });
});
