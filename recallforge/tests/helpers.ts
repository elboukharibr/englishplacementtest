import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

export async function createUser(overrides: Partial<{ email: string; plan: "FREE" | "PRO" }> = {}) {
  return db.user.create({
    data: {
      email: overrides.email ?? `user-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: await hashPassword("correct horse 1"),
      plan: overrides.plan ?? "FREE",
      onboardedAt: new Date(),
    },
  });
}

export const SAMPLE_TEXT = `# Chapter 4: Platforms and Media Power

## Platformization

Platformization refers to the penetration of the infrastructures, economic processes and governance frameworks of digital platforms into different sectors of society. News organisations increasingly depend on platforms for distribution.

Algorithmic curation is the automated ranking and filtering of content by software. Unlike editorial gatekeeping, algorithmic curation is optimised for signals such as engagement.

## Gatekeeping

Gatekeeping is the process by which editors and journalists select which events become news. David Manning White (1950) studied how a wire editor chose stories.

The classic model leads to an emphasis on individual choice because it focuses on single editors rather than organisational routines.

## Mediatization

Mediatization is the process through which media increasingly shape institutions, practices and social interaction. Political communication is a common example because parties adapt their messages to media logic.

## References

Smith, J. (2020). Platforms. Example Press.
`;
