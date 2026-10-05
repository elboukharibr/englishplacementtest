import type { Job } from "@prisma/client";
import { processDocument, markDocumentFailed, markDocumentRetrying } from "@/lib/pipeline/process-document";
import { generateDeck, markDeckFailed, markDeckRetrying } from "@/lib/pipeline/generate-deck";
import { dailyMaintenance } from "@/lib/pipeline/maintenance";

type Handler<P> = ((payload: P, job: Job) => Promise<void>) & {
  onFinalFailure?: (payload: P, error: unknown) => Promise<void>;
  onRetry?: (payload: P, error: unknown) => Promise<void>;
};

function handler<P>(fn: (payload: P, job: Job) => Promise<void>, hooks: { onFinalFailure?: Handler<P>["onFinalFailure"]; onRetry?: Handler<P>["onRetry"] } = {}): Handler<P> {
  return Object.assign(fn, hooks);
}

export const handlers = {
  process_document: handler<{ documentId: string }>((p) => processDocument(p.documentId), {
    onFinalFailure: (p, e) => markDocumentFailed(p.documentId, e),
    onRetry: (p, e) => markDocumentRetrying(p.documentId, e),
  }),
  generate_deck: handler<{ deckId: string }>((p) => generateDeck(p.deckId), {
    onFinalFailure: (p, e) => markDeckFailed(p.deckId, e),
    onRetry: (p, e) => markDeckRetrying(p.deckId, e),
  }),
  daily_maintenance: handler<Record<string, never>>(() => dailyMaintenance()),
};
