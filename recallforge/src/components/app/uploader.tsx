"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert, Progress } from "@/components/ui/misc";
import { api, ApiError, QUOTA_EVENT } from "@/lib/client";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,.pptx,.epub,.txt,.md";

export function Uploader({ initialTab, maxMb }: { initialTab: "file" | "paste"; maxMb: number }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback(
    (f: File | undefined | null) => {
      setError(null);
      if (!f) return;
      if (!/\.(pdf|docx|pptx|epub|txt|md)$/i.test(f.name)) return setError("Unsupported file. Upload a PDF, Word (.docx), PowerPoint (.pptx), EPUB or plain-text file.");
      if (f.size > maxMb * 1024 * 1024) return setError(`This file is ${(f.size / 1048576).toFixed(1)} MB. Your plan allows up to ${maxMb} MB.`);
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    },
    [maxMb, title],
  );

  function uploadFile() {
    if (!file) return;
    setError(null);
    setProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    if (subject) fd.append("subject", subject);
    // XHR gives real upload progress, which fetch() doesn't.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { id?: string; error?: string; details?: Record<string, unknown> } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.id) {
        router.push(`/library/${data.id}`);
        return;
      }
      setProgress(null);
      if (xhr.status === 402) window.dispatchEvent(new CustomEvent(QUOTA_EVENT, { detail: { message: data.error, ...data.details } }));
      setError(data.error ?? "Upload failed. Please try again.");
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Network error — the upload didn't complete. Check your connection and try again.");
    };
    xhr.send(fd);
  }

  async function submitPaste(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setProgress(100);
    try {
      const r = await api<{ id: string }>("/api/documents/paste", { body: { title: fd.get("title"), text: fd.get("text"), subject: fd.get("subject") || undefined } });
      router.push(`/library/${r.id}`);
    } catch (err) {
      setProgress(null);
      if (err instanceof ApiError && err.details?.issues) setError((err.details.issues as { message: string }[]).map((i) => i.message).join(" "));
      else setError(err instanceof ApiError ? err.message : "Couldn't save your text.");
    }
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Upload method" className="inline-flex rounded-xl border border-border bg-surface p-1">
        {(["file", "paste"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-lg px-4 py-1.5 text-sm", tab === t ? "bg-primary-soft font-medium text-primary" : "text-muted")}>
            {t === "file" ? "Upload a file" : "Paste text"}
          </button>
        ))}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {tab === "file" ? (
        <div className="space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={cn("flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors", drag ? "border-primary bg-primary-soft" : "border-border bg-surface")}
          >
            <UploadCloud className="size-10 text-primary" />
            <p className="mt-4 font-serif text-xl font-semibold">Drop your study material here</p>
            <p className="mt-1 text-sm text-muted">or</p>
            <Button variant="secondary" className="mt-3" onClick={() => inputRef.current?.click()}>
              Browse files
            </Button>
            <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" aria-label="Choose a file" onChange={(e) => pick(e.target.files?.[0])} />
            <p className="mt-4 text-xs text-muted">PDF, DOCX, PPTX, EPUB or TXT · up to {maxMb} MB · text-based PDFs only (scanned-PDF OCR is coming soon)</p>
          </div>
          {file && (
            <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <FileUp className="size-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted">{(file.size / 1048576).toFixed(2)} MB</p>
                </div>
                {progress == null && (
                  <Button variant="ghost" size="icon" aria-label="Remove file" onClick={() => setFile(null)}>
                    <X />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Title" htmlFor="title">
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                </Field>
                <Field label="Subject (optional)" htmlFor="subject">
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Media Studies" maxLength={80} />
                </Field>
              </div>
              {progress != null ? (
                <div>
                  <p className="mb-2 text-sm text-muted">{progress < 100 ? `Uploading… ${progress}%` : "Upload complete — starting processing…"}</p>
                  <Progress value={progress} label="Upload progress" />
                </div>
              ) : (
                <Button onClick={uploadFile} disabled={!title.trim()}>
                  Upload and analyze
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submitPaste} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="ptitle">
              <Input id="ptitle" name="title" required maxLength={200} placeholder="e.g. Lecture 5 — Platform governance" />
            </Field>
            <Field label="Subject (optional)" htmlFor="psubject">
              <Input id="psubject" name="subject" maxLength={80} />
            </Field>
          </div>
          <Field label="Text" htmlFor="ptext" hint="Paste a few paragraphs or a whole chapter. Lines starting with # are treated as headings.">
            <Textarea id="ptext" name="text" required minLength={200} className="min-h-[280px] font-serif" />
          </Field>
          <Button type="submit" loading={progress != null}>
            Analyze text
          </Button>
        </form>
      )}
    </div>
  );
}
