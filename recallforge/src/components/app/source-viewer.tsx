"use client";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client";

type Section = { id: string; heading: string | null; path: string | null; text: string; pageStart: number | null; pageEnd: number | null; document: { id: string; title: string } | null };

function highlight(text: string, quote: string | null) {
  if (!quote) return [text];
  const q = quote.replace(/…$/, "").trim();
  const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
  // Find the quote allowing whitespace differences.
  const flat = norm(text);
  const idx = flat.indexOf(norm(q));
  if (idx < 0) return [text];
  // Map flat index back to original string.
  let fi = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < text.length; i++) {
    const isSpace = /\s/.test(text[i]);
    if (isSpace && i > 0 && /\s/.test(text[i - 1])) continue;
    if (fi === idx && start < 0) start = i;
    fi++;
    if (fi === idx + norm(q).length) {
      end = i + 1;
      break;
    }
  }
  if (start < 0 || end < 0) return [text];
  return [text.slice(0, start), <mark key="m" className="source-highlight">{text.slice(start, end)}</mark>, text.slice(end)];
}

export function SourceButton({ sectionId, quote, page, heading, size = "sm" }: { sectionId: string | null; quote: string | null; page: number | null; heading: string | null; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || section || !sectionId) return;
    api<Section>(`/api/sections/${sectionId}`)
      .then(setSection)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load the source."));
  }, [open, section, sectionId]);
  if (!sectionId) return null;
  return (
    <>
      <Button variant="ghost" size={size} onClick={() => setOpen(true)} className="text-primary">
        <BookOpen /> View source
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent wide title={heading ?? "Source passage"} description={[section?.document?.title, page != null ? `Page ${page}` : null].filter(Boolean).join(" · ") || undefined}>
          {error ? (
            <Alert tone="danger">{error}</Alert>
          ) : !section ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-serif text-[15px] leading-relaxed">{highlight(section.text, quote)}</div>
          )}
          <p className="mt-3 text-xs text-muted">The highlighted text is the passage this card was checked against. Private to your account.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
