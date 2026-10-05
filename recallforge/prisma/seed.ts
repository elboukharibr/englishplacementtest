// Development seed: a demo account with clearly labelled demo decks in four subjects.
// Never run against production. Usage: npm run db:seed
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { createSubjectFor, ensureSampleDeck } from "../src/lib/data/sample";
import { DEMO_SUBJECTS } from "../src/lib/data/sample-content";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database.");
  const email = "demo@example.com";
  const password = "demo-password-1";
  await db.user.deleteMany({ where: { email } });
  const user = await db.user.create({
    data: { email, name: "Demo Learner", passwordHash: await hashPassword(password), emailVerifiedAt: new Date(), onboardedAt: new Date(), studyContext: "university", primaryGoal: "exam" },
  });
  await ensureSampleDeck(user.id);
  for (const s of DEMO_SUBJECTS.slice(1)) await createSubjectFor(user.id, s, { isSample: false });
  console.log(`Seeded ${email} / ${password} with ${DEMO_SUBJECTS.length} demo decks (labelled “Demo”/“Sample”).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
