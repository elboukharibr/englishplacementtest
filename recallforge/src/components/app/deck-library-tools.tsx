"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, FolderPlus, Merge, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Input, Label, Select } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/toggle";
import { api, ApiError } from "@/lib/client";

export function DeckLibraryTools({ folders, decks }: { folders: { id: string; name: string; parentId: string | null }[]; decks: { id: string; name: string }[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "folder" | "import" | "merge">(null);
  const [busy, setBusy] = useState(false);
  const [mergeSel, setMergeSel] = useState<string[]>([]);
  const [target, setTarget] = useState("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">
            <MoreHorizontal /> Organize
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setDialog("folder")}>
            <FolderPlus /> New folder
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("import")}>
            <FileUp /> Import cards (CSV/TSV)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("merge")} disabled={decks.length < 2}>
            <Merge /> Merge decks
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "folder"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="New folder" description="Nest folders to mirror your studies, e.g. University › Media Studies › Media Theory.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await api("/api/folders", { body: { name: fd.get("name"), parentId: fd.get("parent") || null } });
                toast.success("Folder created.");
                setDialog(null);
                router.refresh();
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Couldn't create the folder.");
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="f-name">Name</Label>
              <Input id="f-name" name="name" required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-parent">Inside</Label>
              <Select id="f-parent" name="parent" defaultValue="">
                <option value="">Top level</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "import"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="Import cards" description="CSV or TSV with the front in the first column and the back in the second. A header row (Front, Back, Tags) is optional.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await api<{ id: string; imported: number; skipped: number }>("/api/decks/import", { body: new FormData(e.currentTarget) });
                toast.success(`Imported ${r.imported} cards${r.skipped ? ` (${r.skipped} rows skipped)` : ""}.`);
                router.push(`/decks/${r.id}`);
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Import failed.");
                setBusy(false);
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="i-name">Deck name (optional)</Label>
              <Input id="i-name" name="name" maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-file">File</Label>
              <Input id="i-file" name="file" type="file" accept=".csv,.tsv,.txt" required className="py-1.5" />
            </div>
            <p className="text-xs text-muted">Anki package (.apkg) import is planned but not available yet.</p>
            <div className="flex justify-end">
              <Button type="submit" loading={busy}>
                Import
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "merge"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="Merge decks" description="Cards and their review history move into the target deck. The other decks are then removed.">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-target">Target deck</Label>
              <Select id="m-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choose…</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <fieldset className="max-h-56 space-y-2 overflow-y-auto">
              <legend className="mb-2 text-sm font-medium">Merge these into it</legend>
              {decks
                .filter((d) => d.id !== target)
                .map((d) => (
                  <label key={d.id} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={mergeSel.includes(d.id)} onCheckedChange={(v) => setMergeSel((s) => (v === true ? [...s, d.id] : s.filter((x) => x !== d.id)))} />
                    {d.name}
                  </label>
                ))}
            </fieldset>
            <div className="flex justify-end">
              <Button
                disabled={!target || !mergeSel.filter((x) => x !== target).length}
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("/api/decks/merge", { body: { targetId: target, sourceIds: mergeSel.filter((x) => x !== target) } });
                    toast.success("Decks merged.");
                    router.push(`/decks/${target}`);
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : "Merge failed.");
                    setBusy(false);
                  }
                }}
              >
                Merge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
