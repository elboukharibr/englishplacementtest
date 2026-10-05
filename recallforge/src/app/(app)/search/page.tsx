import type { Metadata } from "next";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { search } from "@/lib/data/search";
import { EmptyState, PageHeader, Badge } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireOnboardedUser();
  const { q = "" } = await searchParams;
  const r = q.trim().length >= 2 ? await search(user.id, q) : null;
  const total = r ? r.documents.length + r.decks.length + r.concepts.length + r.cards.length + r.passages.length : 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Search" description={env.embeddingProvider === "openai" ? "Semantic search across documents, cards, concepts and source passages." : "Search across documents, cards, concepts and source passages."} />
      <form role="search" className="flex gap-2">
        <label htmlFor="sq" className="sr-only">
          Search
        </label>
        <Input id="sq" name="q" defaultValue={q} placeholder="e.g. platformization" autoFocus />
        <Button type="submit">Search</Button>
      </form>
      {!r ? (
        <EmptyState icon={SearchIcon} title="Search your study library" description="Find a concept, a card, or the passage where something was explained." />
      ) : total === 0 ? (
        <EmptyState icon={SearchIcon} title={`No results for “${q}”`} description="Try a broader term or check the spelling." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {r.concepts.length > 0 && (
            <Section title="Concepts & definitions">
              {r.concepts.map((c) => (
                <li key={c.id}>
                  <Link href={`/library/${c.documentId}`} className="block rounded-xl p-3 hover:bg-surface-2">
                    <p className="font-medium">
                      {c.name} <Badge className="ml-1">{c.kind.replace("_", " ")}</Badge>
                    </p>
                    <p className="mt-1 text-sm text-muted">{c.summary}</p>
                    <p className="mt-1 text-xs text-muted">{c.documentTitle}</p>
                  </Link>
                </li>
              ))}
            </Section>
          )}
          {r.cards.length > 0 && (
            <Section title="Cards">
              {r.cards.map((c) => (
                <li key={c.id}>
                  <Link href={`/decks/${c.deckId}`} className="block rounded-xl p-3 hover:bg-surface-2">
                    <p className="font-medium">{c.question.replace(/\{\{(.+?)\}\}/g, "[…]")}</p>
                    <p className="mt-1 text-sm text-muted">{c.answer}</p>
                    <p className="mt-1 text-xs text-muted">{c.deckName}</p>
                  </Link>
                </li>
              ))}
            </Section>
          )}
          {r.passages.length > 0 && (
            <Section title="Source passages">
              {r.passages.map((p) => (
                <li key={p.id}>
                  <Link href={`/library/${p.documentId}`} className="block rounded-xl p-3 hover:bg-surface-2">
                    <p className="text-sm font-medium">
                      {p.heading ?? "Passage"}
                      {p.pageStart != null && <span className="font-normal text-muted"> · p. {p.pageStart}</span>}
                    </p>
                    <p className="mt-1 font-serif text-sm text-fg/80">{p.snippet}</p>
                    <p className="mt-1 text-xs text-muted">{p.documentTitle}</p>
                  </Link>
                </li>
              ))}
            </Section>
          )}
          {(r.documents.length > 0 || r.decks.length > 0) && (
            <Section title="Documents & decks">
              {r.documents.map((d) => (
                <li key={d.id}>
                  <Link href={`/library/${d.id}`} className="block rounded-xl p-3 hover:bg-surface-2">
                    {d.title} <span className="text-xs text-muted">· {d.fileType.toUpperCase()}</span>
                  </Link>
                </li>
              ))}
              {r.decks.map((d) => (
                <li key={d.id}>
                  <Link href={`/decks/${d.id}`} className="block rounded-xl p-3 hover:bg-surface-2">
                    {d.name} <span className="text-xs text-muted">· deck</span>
                  </Link>
                </li>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-3">
      <h2 className="px-3 pb-1 pt-2 text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}
