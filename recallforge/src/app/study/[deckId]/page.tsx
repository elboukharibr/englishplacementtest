import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { StudySession } from "@/components/study/study-session";
import { ReducedMotion } from "@/components/app/reduced-motion";

export const metadata: Metadata = { title: "Study" };

/** Distraction-free study. deckId "all" reviews every deck. */
export default async function StudyPage({ params, searchParams }: { params: Promise<{ deckId: string }>; searchParams: Promise<{ mode?: string; topic?: string; decks?: string }> }) {
  const user = await requireOnboardedUser();
  const { deckId } = await params;
  const sp = await searchParams;
  const mode = (["study", "review", "weak", "cram"].includes(sp.mode ?? "") ? sp.mode : "study") as "study" | "review" | "weak" | "cram";
  let title = mode === "weak" ? "Weak topics" : "Today's review";
  let deckIds: string[] | undefined;
  let backHref = "/review";
  if (deckId !== "all") {
    const deck = await db.deck.findFirst({ where: { id: deckId, userId: user.id }, select: { id: true, name: true } });
    if (!deck) notFound();
    deckIds = [deck.id];
    title = sp.topic ? `${deck.name} — ${sp.topic}` : deck.name;
    backHref = `/decks/${deck.id}`;
  } else if (sp.decks) {
    deckIds = sp.decks.split(",").slice(0, 50);
  }
  return (
    <>
      <ReducedMotion enabled={user.reducedMotion} />
      <StudySession deckIds={deckIds} mode={mode} topic={sp.topic ?? null} title={title} backHref={backHref} />
    </>
  );
}
