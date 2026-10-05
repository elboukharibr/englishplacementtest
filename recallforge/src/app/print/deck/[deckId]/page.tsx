import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { deckWithCards } from "@/lib/data/decks";
import { clozeBack, clozeFront } from "@/lib/export/formats";
import { PrintButton } from "@/components/app/print-button";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Print deck", robots: { index: false } };

export default async function PrintDeck({ params, searchParams }: { params: Promise<{ deckId: string }>; searchParams: Promise<{ layout?: string }> }) {
  const user = await requireUser();
  const { deckId } = await params;
  const { layout } = await searchParams;
  const deck = await deckWithCards(user.id, deckId);
  if (!deck) notFound();
  const cards = deck.cards.filter((c) => !c.suspended);
  const sheet = layout === "sheet";
  return (
    <main className="mx-auto max-w-4xl bg-white px-8 py-10 text-[#14213d]">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-sm">
        <PrintButton />
        <a href={`?layout=${sheet ? "cards" : "sheet"}`} className="underline">
          Switch to {sheet ? "flashcard" : "study-sheet"} layout
        </a>
        <span className="text-muted">Use your browser&apos;s “Save as PDF” option to create a PDF.</span>
      </div>
      <header className="mb-6 border-b border-gray-300 pb-3">
        <h1 className="font-serif text-2xl font-semibold">{deck.name}</h1>
        <p className="text-sm text-gray-600">
          {deck.document?.title ? `Source: ${deck.document.title} · ` : ""}
          {cards.length} cards · {BRAND.name}
        </p>
      </header>
      {sheet ? (
        <ol className="space-y-3">
          {cards.map((c, i) => (
            <li key={c.id} className="break-inside-avoid border-b border-gray-200 pb-3">
              <p className="font-medium">
                {i + 1}. {c.cardType === "cloze" ? clozeFront(c.question) : c.question}
              </p>
              <p className="mt-1 text-sm">{c.cardType === "cloze" ? clozeBack(c.question) : c.answer}</p>
              {c.sourcePage != null && <p className="mt-0.5 text-xs text-gray-500">p. {c.sourcePage}{c.sourceHeading ? ` · ${c.sourceHeading}` : ""}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid grid-cols-2 gap-0">
          {cards.map((c) => (
            <div key={c.id} className="flex min-h-[2.4in] break-inside-avoid flex-col justify-between border border-dashed border-gray-400 p-4">
              <p className="font-serif text-[15px]">{c.cardType === "cloze" ? clozeFront(c.question) : c.question}</p>
              <div className="mt-3 border-t border-gray-200 pt-2">
                <p className="text-sm">{c.cardType === "cloze" ? clozeBack(c.question) : c.answer}</p>
                {c.sourcePage != null && <p className="mt-1 text-[11px] text-gray-500">p. {c.sourcePage}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
