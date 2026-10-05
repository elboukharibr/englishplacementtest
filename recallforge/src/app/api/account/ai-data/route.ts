import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withUser, ok } from "@/lib/api";

/** Removes AI-generated data (generated cards, concepts, tutor history, exam attempts) but keeps uploads and manual cards. */
export const DELETE = withUser(async (_req, user) => {
  const [cards, concepts, tutor, exams] = await db.$transaction([
    db.card.deleteMany({ where: { userId: user.id, origin: "ai" } }),
    db.concept.deleteMany({ where: { document: { userId: user.id } } }),
    db.tutorMessage.deleteMany({ where: { userId: user.id } }),
    db.examAttempt.deleteMany({ where: { userId: user.id } }),
  ]);
  await db.document.updateMany({ where: { userId: user.id }, data: { analysis: Prisma.DbNull } });
  return ok({ cards: cards.count, concepts: concepts.count, tutorMessages: tutor.count, examAttempts: exams.count });
});
