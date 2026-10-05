import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/billing/usage";
import { PageHeader } from "@/components/ui/misc";
import { TutorChat } from "@/components/study/tutor-chat";

export const metadata: Metadata = { title: "AI Tutor" };

export default async function TutorPage({ params }: { params: Promise<{ deckId: string }> }) {
  const user = await requireOnboardedUser();
  const { deckId } = await params;
  const deck = await db.deck.findFirst({ where: { id: deckId, userId: user.id }, select: { id: true, name: true, isSample: true, documentId: true } });
  if (!deck) notFound();
  if (!deck.isSample && !hasFeature(user, "tutor")) redirect("/pricing");
  const threadId = `deck-${deck.id}`;
  const history = await db.tutorMessage.findMany({ where: { userId: user.id, threadId }, orderBy: { createdAt: "asc" }, take: 60 });
  return (
    <div>
      <Link href={`/decks/${deck.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {deck.name}
      </Link>
      <PageHeader title="AI tutor" description={deck.documentId ? "Grounded in this deck's source document." : "This deck has no source document, so answers can't cite your material."} />
      <TutorChat
        deckId={deck.id}
        threadId={threadId}
        initial={history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content, citations: (m.citations as never) ?? undefined }))}
      />
    </div>
  );
}
