"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Checkbox } from "@/components/ui/toggle";
import { api, ApiError } from "@/lib/client";

export function DocumentActions({ documentId, title, hasDecks }: { documentId: string; title: string; hasDecks: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [withDecks, setWithDecks] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Document actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpen(true)} className="text-danger">
            <Trash2 /> Delete document
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Delete “${title}”?`} description="The uploaded file, its extracted text, search index and concepts will be permanently deleted.">
          {hasDecks && (
            <label className="mb-4 flex items-center gap-3 text-sm">
              <Checkbox checked={withDecks} onCheckedChange={(v) => setWithDecks(v === true)} /> Also delete decks made from it (otherwise they're kept, without source links)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/api/documents/${documentId}${withDecks ? "?decks=delete" : ""}`, { method: "DELETE" });
                  toast.success("Document deleted.");
                  router.push("/library");
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
