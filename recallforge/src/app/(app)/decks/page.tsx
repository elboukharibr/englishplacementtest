import type { Metadata } from "next";
import Link from "next/link";
import { Folder, Layers, Upload } from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listDeckSummaries } from "@/lib/data/decks";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { DeckCard } from "@/components/app/deck-card";
import { DeckLibraryTools } from "@/components/app/deck-library-tools";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Decks" };

type SP = { folder?: string; view?: string; tag?: string; subject?: string };

export default async function DecksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireOnboardedUser();
  const sp = await searchParams;
  const [all, folders] = await Promise.all([listDeckSummaries(user.id, { includeArchived: true }), db.folder.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } })]);
  const view = sp.view ?? "all";
  let decks = all.filter((d) => (view === "archived" ? d.archived : !d.archived));
  if (view === "favorites") decks = decks.filter((d) => d.favorite);
  if (sp.folder) {
    // Include decks in subfolders.
    const ids = new Set([sp.folder]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          grew = true;
        }
      }
    }
    decks = decks.filter((d) => d.folderId && ids.has(d.folderId));
  }
  if (sp.tag) decks = decks.filter((d) => d.tags.includes(sp.tag!));
  if (sp.subject) decks = decks.filter((d) => d.subject === sp.subject);
  const tags = [...new Set(all.flatMap((d) => d.tags))].sort();
  const subjects = [...new Set(all.map((d) => d.subject).filter(Boolean) as string[])].sort();

  // Folder tree (University → Media Studies → Media Theory …)
  const children = (parentId: string | null) => folders.filter((f) => f.parentId === parentId);
  const Tree = ({ parentId, depth }: { parentId: string | null; depth: number }) => (
    <ul className={cn(depth > 0 && "ml-3 border-l border-border pl-2")}>
      {children(parentId).map((f) => (
        <li key={f.id}>
          <Link href={`/decks?folder=${f.id}`} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2", sp.folder === f.id && "bg-primary-soft text-primary")}>
            <Folder className="size-4" /> <span className="truncate">{f.name}</span>
          </Link>
          <Tree parentId={f.id} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );

  const link = (v: string, label: string) => (
    <Link href={v === "all" ? "/decks" : `/decks?view=${v}`} className={cn("block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2", view === v && !sp.folder && !sp.tag && !sp.subject && "bg-primary-soft text-primary")}>
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="Decks"
        actions={
          <>
            <DeckLibraryTools folders={folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))} decks={all.filter((d) => !d.archived && d.status === "READY").map((d) => ({ id: d.id, name: d.name }))} />
            <Button asChild>
              <Link href="/upload">
                <Upload /> New from document
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-5" aria-label="Deck filters">
          <nav className="space-y-0.5">
            {link("all", "All decks")}
            {link("favorites", "Favorites")}
            {link("archived", "Archived")}
          </nav>
          <div>
            <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted">Folders</p>
            {folders.length ? <Tree parentId={null} depth={0} /> : <p className="px-2 text-xs text-muted">No folders yet.</p>}
          </div>
          {subjects.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted">Subjects</p>
              {subjects.map((s) => (
                <Link key={s} href={`/decks?subject=${encodeURIComponent(s)}`} className={cn("block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2", sp.subject === s && "bg-primary-soft text-primary")}>
                  {s}
                </Link>
              ))}
            </div>
          )}
          {tags.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted">Tags</p>
              <div className="flex flex-wrap gap-1.5 px-2">
                {tags.map((t) => (
                  <Link key={t} href={`/decks?tag=${encodeURIComponent(t)}`} className={cn("rounded-full px-2 py-0.5 text-xs", sp.tag === t ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted")}>
                    #{t}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
        <div>
          {decks.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={view === "archived" ? "No archived decks." : "No decks here yet."}
              description={view === "all" && !sp.folder ? "Upload a document to generate your first deck, or import cards from CSV." : "Decks you move here will show up in this view."}
              action={
                view === "all" && !sp.folder ? (
                  <Button asChild>
                    <Link href="/upload">Upload material</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {decks.map((d) => (
                <DeckCard key={d.id} deck={d} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
