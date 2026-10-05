import Link from "next/link";
import { AlertTriangle, Loader2, Star } from "lucide-react";
import type { DeckSummary } from "@/lib/data/decks";
import { Badge, Progress } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";

export function DeckCard({ deck }: { deck: DeckSummary }) {
  const pct = Math.round(deck.mastery.mastery * 100);
  if (deck.status === "GENERATING") {
    return (
      <Link href={`/decks/${deck.id}`} className="block min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)] hover:border-primary/40">
        <p className="font-medium">{deck.name}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> {deck.statusMessage ?? "Generating…"}
        </p>
        <Progress value={deck.progress} className="mt-4" label="Generation progress" />
      </Link>
    );
  }
  if (deck.status === "FAILED") {
    return (
      <Link href={`/decks/${deck.id}`} className="block min-w-0 rounded-2xl border border-danger/30 bg-danger-soft p-5">
        <p className="font-medium">{deck.name}</p>
        <p className="mt-1 flex items-start gap-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {deck.statusMessage ?? "Generation failed."} Open to retry.
        </p>
      </Link>
    );
  }
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/decks/${deck.id}`} className="line-clamp-2 font-medium hover:text-primary">
            {deck.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">{deck.documentTitle ?? "No source document"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {deck.isSample && <Badge tone="primary">Sample</Badge>}
          {deck.favorite && <Star className="size-4 fill-warning text-warning" aria-label="Favorite" />}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-muted">{deck.cardCount} cards</span>
        {deck.subject && <span className="text-muted">{deck.subject}</span>}
        {deck.due > 0 && <span className="font-medium text-warning">{deck.due} due</span>}
        {deck.newCount > 0 && <span className="text-muted">{deck.newCount} new</span>}
        {deck.needsVerification > 0 && <span className="text-xs text-muted">{deck.needsVerification} to verify</span>}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Mastery</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} tone="success" label={`Mastery ${pct}%`} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Studied {formatRelative(deck.lastStudiedAt)}</span>
        <Button asChild size="sm" variant={deck.due > 0 ? "primary" : "secondary"}>
          <Link href={`/study/${deck.id}`}>Study now</Link>
        </Button>
      </div>
    </div>
  );
}
