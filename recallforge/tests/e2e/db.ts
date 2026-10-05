import { PrismaClient } from "@prisma/client";

export const e2eDb = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/recallforge_e2e" } } });

/** Simulates time passing: makes every already-reviewed card for this user due now. */
export async function fastForward(email: string) {
  const user = await e2eDb.user.findUniqueOrThrow({ where: { email } });
  await e2eDb.card.updateMany({ where: { userId: user.id, reps: { gt: 0 } }, data: { due: new Date(Date.now() - 60_000) } });
  return user;
}
