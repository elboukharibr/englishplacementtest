"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Download, FolderInput, MoreHorizontal, Pencil, Printer, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Input, Label, Select } from "@/components/ui/form";
import { api, ApiError } from "@/lib/client";

export function DeckActions({ deck, folders, canApkg }: { deck: { id: string; name: string; favorite: boolean; archived: boolean; folderId: string | null; tags: string[] }; folders: { id: string; name: string }[]; canApkg: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "rename" | "delete" | "move">(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, msg: string) {
    try {
      await api(`/api/decks/${deck.id}`, { method: "PATCH", body });
      toast.success(msg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't update the deck.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">
            <Download /> Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Export deck</DropdownMenuLabel>
          <DropdownMenuItem asChild disabled={!canApkg}>
            <a href={canApkg ? `/api/decks/${deck.id}/export?format=apkg` : "/pricing"}>Anki package (.apkg){!canApkg && " — Pro"}</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/decks/${deck.id}/export?format=csv`}>CSV (Front, Back, Source, Tags)</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/decks/${deck.id}/export?format=quizlet`}>Quizlet (tab-separated)</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/decks/${deck.id}/export?format=txt`}>Plain text</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/print/deck/${deck.id}`} target="_blank" rel="noreferrer">
              <Printer /> Printable PDF
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Deck actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => patch({ favorite: !deck.favorite }, deck.favorite ? "Removed from favorites." : "Added to favorites.")}>
            <Star /> {deck.favorite ? "Unfavorite" : "Favorite"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("move")}>
            <FolderInput /> Move to folder
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              try {
                const r = await api<{ id: string }>(`/api/decks/${deck.id}/duplicate`, { body: {} });
                toast.success("Deck duplicated.");
                router.push(`/decks/${r.id}`);
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : "Couldn't duplicate.");
              }
            }}
          >
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => patch({ archived: !deck.archived }, deck.archived ? "Deck restored." : "Deck archived. Its cards won't appear in reviews.")}>
            {deck.archived ? <ArchiveRestore /> : <Archive />} {deck.archived ? "Unarchive" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("delete")} className="text-danger">
            <Trash2 /> Delete deck
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "rename"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="Rename deck">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const tags = String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
              await patch({ name: String(fd.get("name")), tags }, "Deck updated.");
              setDialog(null);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="rn-name">Name</Label>
              <Input id="rn-name" name="name" defaultValue={deck.name} required maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rn-tags">Tags (comma-separated)</Label>
              <Input id="rn-tags" name="tags" defaultValue={deck.tags.join(", ")} />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "move"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="Move to folder">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = String(new FormData(e.currentTarget).get("folder"));
              await patch({ folderId: v || null }, "Deck moved.");
              setDialog(null);
            }}
          >
            <Select name="folder" defaultValue={deck.folderId ?? ""} aria-label="Folder">
              <option value="">No folder (top level)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            {folders.length === 0 && <p className="text-xs text-muted">Create folders from the Decks page.</p>}
            <div className="flex justify-end">
              <Button type="submit">Move</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title={`Delete “${deck.name}”?`} description="All cards and their review history will be permanently deleted. The source document is kept.">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/api/decks/${deck.id}`, { method: "DELETE" });
                  toast.success("Deck deleted.");
                  router.push("/decks");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : "Couldn't delete.");
                  setBusy(false);
                }
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
