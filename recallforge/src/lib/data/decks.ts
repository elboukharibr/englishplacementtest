import { db } from "@/lib/db";
import { deckMastery, type MasteryBreakdown } from "@/lib/srs/mastery";

export type DeckSummary = {
  id: string;
  name: string;
  subject: string | null;
  documentTitle: string | null;
  documentId: string | null;
  status: string;
  progress: number;
  statusMessage: string | null;
  isSample: boolean;
  favorite: boolean;
  archived: boolean;
  folderId: string | null;
  tags: string[];
  cardCount: number;
  due: number;
  needsVerification: number;
  mastery: MasteryBreakdown;
  lastStudiedAt: Date | null;
  createdAt: Date;
};

export async function listDeckSummaries(userId: string, opts: { includeArchived?: boolean; take?: number } = {}): Promise<DeckSummary[]> {
  const now = new Date();
  const decks = await db.deck.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archived: false }) },
    orderBy: [{ isSample: "asc" }, { updatedAt: "desc" }],
    take: opts.take,
    include: {
      document: { select: { title: true } },
      cards: { where: { suspended: false }, select: { state: true, stability: true, lastReview: true, lapses: true, reps: true, due: true, needsVerification: true } },
    },
  });
  return decks.map((d) => ({
    id: d.id,
    name: d.name,
    subject: d.subject,
    documentTitle: d.document?.title ?? null,
    documentId: d.documentId,
    status: d.status,
    progress: d.progress,
    statusMessage: d.statusMessage,
    isSample: d.isSample,
    favorite: d.favorite,
    archived: d.archived,
    folderId: d.folderId,
    tags: d.tags,
    cardCount: d.cards.length,
    due: d.cards.filter((c) => c.due <= now).length,
    needsVerification: d.cards.filter((c) => c.needsVerification).length,
    mastery: deckMastery(d.cards, now),
    lastStudiedAt: d.lastStudiedAt,
    createdAt: d.createdAt,
  }));
}

export async function deckWithCards(userId: string, deckId: string) {
  return db.deck.findFirst({
    where: { id: deckId, userId },
    include: {
      document: { select: { id: true, title: true, fileType: true, pageCount: true } },
      folder: true,
      cards: { orderBy: [{ needsVerification: "desc" }, { importance: "desc" }, { createdAt: "asc" }] },
    },
  });
}
