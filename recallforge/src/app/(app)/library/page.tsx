import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deckMastery } from "@/lib/srs/mastery";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/form";
import { pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Library" };

const STATUS: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "danger" }> = {
  UPLOADED: { label: "Queued", tone: "neutral" },
  EXTRACTING: { label: "Extracting", tone: "primary" },
  ANALYZING: { label: "Analyzing", tone: "primary" },
  READY: { label: "Ready", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; type?: string; sort?: string }> }) {
  const user = await requireOnboardedUser();
  const sp = await searchParams;
  const docs = await db.document.findMany({
    where: {
      userId: user.id,
      ...(sp.q ? { title: { contains: sp.q, mode: "insensitive" as const } } : {}),
      ...(sp.subject ? { subject: sp.subject } : {}),
      ...(sp.type ? { fileType: sp.type } : {}),
    },
    orderBy: sp.sort === "title" ? { title: "asc" } : sp.sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" },
    include: { decks: { select: { id: true, cards: { select: { state: true, stability: true, lastReview: true, lapses: true, reps: true } } } } },
    take: 200,
  });
  const subjects = (await db.document.findMany({ where: { userId: user.id, subject: { not: null } }, distinct: ["subject"], select: { subject: true } })).map((d) => d.subject!);
  let rows = docs.map((d) => {
    const cards = d.decks.flatMap((x) => x.cards);
    return { d, decks: d.decks.length, cards: cards.length, mastery: cards.some((c) => c.state !== "NEW") ? deckMastery(cards).mastery : null };
  });
  if (sp.sort === "mastery") rows = rows.sort((a, b) => (a.mastery ?? -1) - (b.mastery ?? -1));

  return (
    <div>
      <PageHeader
        title="Library"
        description="Your uploaded documents. Each can produce several decks."
        actions={
          <Button asChild>
            <Link href="/upload">
              <Upload /> Upload
            </Link>
          </Button>
        }
      />
      <form className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <label className="sr-only" htmlFor="lib-q">
          Search your library
        </label>
        <Input id="lib-q" name="q" defaultValue={sp.q} placeholder="Search your library" />
        <Select name="subject" defaultValue={sp.subject ?? ""} aria-label="Subject">
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select name="type" defaultValue={sp.type ?? ""} aria-label="File type">
          <option value="">All types</option>
          {["pdf", "docx", "pptx", "epub", "txt", "paste"].map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sp.sort ?? "newest"} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title</option>
          <option value="mastery">Lowest mastery</option>
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={sp.q || sp.subject || sp.type ? "No documents match these filters." : "Your study library is empty."}
          description={sp.q || sp.subject || sp.type ? "Try clearing the filters." : "Upload a textbook chapter, paper, or notes and we'll turn it into a study deck."}
          action={
            <Button asChild>
              <Link href="/upload">Upload material</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ d, decks, cards, mastery }) => (
            <Link key={d.id} href={`/library/${d.id}`} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)] hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 font-medium">{d.title}</p>
                <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                {d.fileType.toUpperCase()} · {d.pageCount ? `${d.pageCount} pages` : "pages pending"} · {d.createdAt.toLocaleDateString()}
                {d.isSample && " · Sample"}
              </p>
              <div className="mt-4 flex gap-4 text-sm text-muted">
                <span>{decks} deck{decks === 1 ? "" : "s"}</span>
                <span>{cards} cards</span>
                {d.subject && <span className="truncate">{d.subject}</span>}
              </div>
              {mastery != null && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>Mastery</span>
                    <span>{pct(mastery)}</span>
                  </div>
                  <Progress value={mastery * 100} tone="success" label="Mastery" />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
