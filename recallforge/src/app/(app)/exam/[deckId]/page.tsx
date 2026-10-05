import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/billing/usage";
import { PageHeader } from "@/components/ui/misc";
import { ExamSession } from "@/components/study/exam-session";

export const metadata: Metadata = { title: "Exam" };

export default async function ExamPage({ params, searchParams }: { params: Promise<{ deckId: string }>; searchParams: Promise<{ mode?: string }> }) {
  const user = await requireOnboardedUser();
  const { deckId } = await params;
  const { mode } = await searchParams;
  const oral = mode === "oral";
  const deck = await db.deck.findFirst({ where: { id: deckId, userId: user.id }, select: { id: true, name: true, isSample: true } });
  if (!deck) notFound();
  if (!deck.isSample && !hasFeature(user, oral ? "oralExam" : "examMode")) redirect("/pricing");
  return (
    <div>
      <Link href={`/decks/${deck.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {deck.name}
      </Link>
      <PageHeader title={oral ? "Oral exam mode" : "Exam mode"} />
      <ExamSession deckId={deck.id} deckName={deck.name} oral={oral} />
    </div>
  );
}
