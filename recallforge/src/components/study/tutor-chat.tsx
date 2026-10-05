"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { SourceButton } from "@/components/app/source-viewer";
import { QUOTA_EVENT } from "@/lib/client";
import { cn } from "@/lib/utils";

type Citation = { ref: string; sectionId: string; heading: string | null; page: number | null };
type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

const PROMPTS = ["Explain the main concept of this chapter", "Give me an example", "Explain more simply", "Create a mnemonic", "Ask me a question about this chapter", "What are the key distinctions I should know?"];

function renderWithCitations(text: string, citations: Citation[] = []) {
  const parts = text.split(/(\[S\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(S\d+)\]$/);
    if (!m) return <span key={i}>{p}</span>;
    const c = citations.find((x) => x.ref === m[1]);
    return (
      <sup key={i} className="mx-0.5 rounded bg-primary-soft px-1 text-[10px] font-semibold text-primary" title={c ? `${c.heading ?? "Source"}${c.page ? `, p. ${c.page}` : ""}` : undefined}>
        {m[1]}
      </sup>
    );
  });
}

export function TutorChat({ deckId, initial, threadId }: { deckId: string; initial: Msg[]; threadId: string }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deckId, threadId, message }) });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) window.dispatchEvent(new CustomEvent(QUOTA_EVENT, { detail: { message: data.error, ...data.details } }));
        throw new Error(data.error ?? "The tutor is unavailable right now.");
      }
      const citations: Citation[] = JSON.parse(decodeURIComponent(res.headers.get("X-Sources") ?? "%5B%5D"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc, citations }]);
      }
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[420px] flex-col rounded-3xl border border-border bg-surface">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg py-8 text-center">
            <p className="font-serif text-lg font-semibold">Ask about this material</p>
            <p className="mt-1 text-sm text-muted">Answers are based on your document and cite it as [S1], [S2]… Anything from outside your material is labelled.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {PROMPTS.map((p) => (
                <button key={p} onClick={() => send(p)} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed", m.role === "user" ? "bg-primary text-primary-fg" : "bg-surface-2")}>
              {m.role === "assistant" && !m.content ? (
                <span className="inline-flex gap-1" aria-label="Tutor is typing">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:120ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:240ms]" />
                </span>
              ) : (
                <div className="whitespace-pre-wrap">{m.role === "assistant" ? renderWithCitations(m.content, m.citations) : m.content}</div>
              )}
              {m.role === "assistant" && m.citations && m.citations.length > 0 && m.content && !streaming && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
                  {m.citations
                    .filter((c) => m.content.includes(`[${c.ref}]`))
                    .map((c) => (
                      <SourceButton key={c.ref} sectionId={c.sectionId} quote={null} page={c.page} heading={`${c.ref}: ${c.heading ?? "Source"}`} />
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="tutor-input" className="sr-only">
          Ask the tutor
        </label>
        <Textarea
          id="tutor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask anything about this material…"
          className="min-h-[44px] flex-1 resize-none"
          rows={1}
          maxLength={4000}
        />
        <Button type="submit" size="icon" className="h-11 w-11" disabled={!input.trim() || streaming} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  );
}
