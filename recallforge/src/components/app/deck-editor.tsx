"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, ChevronDown, Lightbulb, Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/toggle";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { SourceButton } from "./source-viewer";
import { CardText } from "./card-text";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { TYPE_LABELS } from "@/lib/card-types";

export type EditorCard = {
  id: string;
  question: string;
  answer: string;
  cardType: string;
  difficulty: string;
  topic: string | null;
  sourceSectionId: string | null;
  sourceQuote: string | null;
  sourcePage: number | null;
  sourceHeading: string | null;
  confidenceLabel: string | null;
  needsVerification: boolean;
  suspended: boolean;
  origin: string;
  state: string;
};


const IMPROVE: [string, string][] = [
  ["easier", "Make easier"],
  ["harder", "Make harder"],
  ["shorter", "Make shorter"],
  ["more_precise", "Make more precise"],
  ["to_cloze", "Turn into cloze"],
  ["to_application", "Turn into application question"],
  ["to_exam", "Turn into exam question"],
  ["split", "Split into multiple cards"],
  ["explain", "Add explanation to answer"],
  ["regenerate", "Regenerate"],
];

const CONF: Record<string, { label: string; tone: "success" | "primary" | "warning" }> = {
  high: { label: "High confidence", tone: "success" },
  medium: { label: "Medium confidence", tone: "primary" },
  review: { label: "Review recommended", tone: "warning" },
};

function CardForm({ initial, onSave, onCancel, busy }: { initial?: Partial<EditorCard>; onSave: (v: { question: string; answer: string; cardType: string; difficulty: string }) => void; onCancel: () => void; busy?: boolean }) {
  const [q, setQ] = useState(initial?.question ?? "");
  const [a, setA] = useState(initial?.answer ?? "");
  const [type, setType] = useState(initial?.cardType ?? "basic");
  const [diff, setDiff] = useState(initial?.difficulty ?? "intermediate");
  const clozeInvalid = type === "cloze" && !/\{\{.+?\}\}/.test(q);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!clozeInvalid) onSave({ question: q.trim(), answer: a.trim(), cardType: type, difficulty: diff });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cf-q">Question</Label>
        <Textarea id="cf-q" value={q} onChange={(e) => setQ(e.target.value)} required maxLength={600} className="min-h-[72px]" />
        {type === "cloze" && <p className={cn("text-xs", clozeInvalid ? "text-danger" : "text-muted")}>Wrap the hidden term in double braces: {"{{term}}"}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-a">Answer</Label>
        <Textarea id="cf-a" value={a} onChange={(e) => setA(e.target.value)} required maxLength={800} className="min-h-[72px]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-t">Type</Label>
          <Select id="cf-t" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-d">Difficulty</Label>
          <Select id="cf-d" value={diff} onChange={(e) => setDiff(e.target.value)}>
            {["basic", "intermediate", "advanced", "expert"].map((d) => (
              <option key={d} value={d}>
                {d[0].toUpperCase() + d.slice(1)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!q.trim() || !a.trim() || clozeInvalid}>
          Save
        </Button>
      </div>
    </form>
  );
}

function CardRow({ card, selected, onSelect, onChange, onRemove, onReplace }: { card: EditorCard; selected: boolean; onSelect: (v: boolean) => void; onChange: (c: EditorCard) => void; onRemove: () => void; onReplace: (cards: EditorCard[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const conf = card.confidenceLabel ? CONF[card.confidenceLabel] : null;

  async function save(v: { question: string; answer: string; cardType: string; difficulty: string }) {
    setBusy("save");
    try {
      const r = await api<{ card: EditorCard }>(`/api/cards/${card.id}`, { method: "PATCH", body: v });
      onChange(r.card);
      setEditing(false);
      toast.success("Card saved.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  }
  async function improve(action: string) {
    setBusy(action);
    try {
      const r = await api<{ cards: EditorCard[]; replaced: string | null }>(`/api/cards/${card.id}/improve`, { body: { action } });
      if (r.replaced) {
        onReplace(r.cards);
        toast.success(`Split into ${r.cards.length} cards.`);
      } else {
        onChange(r.cards[0]);
        toast.success("Card updated.");
      }
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 402)) toast.error(e instanceof ApiError ? e.message : "Couldn't improve this card.");
    } finally {
      setBusy(null);
    }
  }
  async function explain() {
    setBusy("explain-answer");
    try {
      const r = await api<{ explanation: string }>(`/api/cards/${card.id}/explain`, { body: {} });
      setExplanation(r.explanation);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 402)) toast.error(e instanceof ApiError ? e.message : "Couldn't explain.");
    } finally {
      setBusy(null);
    }
  }
  async function verify() {
    const r = await api<{ card: EditorCard }>(`/api/cards/${card.id}`, { method: "PATCH", body: { verified: true } }).catch(() => null);
    if (r) onChange(r.card);
  }
  async function remove() {
    try {
      await api(`/api/cards/${card.id}`, { method: "DELETE" });
      onRemove();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete.");
    }
  }

  return (
    <li className={cn("rounded-2xl border bg-surface p-4", card.needsVerification ? "border-warning/40" : "border-border", card.suspended && "opacity-60")}>
      {editing ? (
        <CardForm initial={card} onSave={save} onCancel={() => setEditing(false)} busy={busy === "save"} />
      ) : (
        <div className="flex gap-3">
          <Checkbox checked={selected} onCheckedChange={(v) => onSelect(v === true)} aria-label="Select card" className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              <CardText text={card.question} cloze={card.cardType === "cloze"} />
            </p>
            <p className="mt-1.5 text-sm text-fg/80">{card.cardType === "cloze" ? <CardText text={card.question} cloze reveal /> : card.answer}</p>
            {explanation && <p className="mt-2 rounded-lg bg-primary-soft p-3 text-sm">{explanation}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge>{TYPE_LABELS[card.cardType] ?? card.cardType}</Badge>
              <Badge>{card.difficulty}</Badge>
              {conf && <Badge tone={conf.tone}>{conf.label}</Badge>}
              {card.origin !== "ai" && <Badge>{card.origin === "manual" ? "Manual" : card.origin === "import" ? "Imported" : "Sample"}</Badge>}
              {card.suspended && <Badge>Suspended</Badge>}
              {card.sourcePage != null && (
                <span className="text-xs text-muted">
                  p. {card.sourcePage}
                  {card.sourceHeading ? ` · ${card.sourceHeading}` : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
            {card.needsVerification && (
              <Button size="sm" variant="secondary" onClick={verify} title="I checked this card">
                <CheckCheck /> <span className="hidden sm:inline">Looks right</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" loading={!!busy && busy !== "save"} aria-label="Improve card with AI">
                  <Wand2 /> <span className="hidden sm:inline">Improve</span>
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Improve card</DropdownMenuLabel>
                {IMPROVE.map(([k, label]) => (
                  <DropdownMenuItem key={k} onSelect={() => improve(k)} disabled={!card.sourceSectionId}>
                    <Sparkles /> {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={explain}>
                  <Lightbulb /> Explain answer
                </DropdownMenuItem>
                {!card.sourceSectionId && <p className="px-2.5 py-1.5 text-xs text-muted">AI rewrites need a source passage.</p>}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit card">
              <Pencil />
            </Button>
            <Button size="sm" variant="ghost" onClick={remove} aria-label="Delete card">
              <Trash2 />
            </Button>
          </div>
        </div>
      )}
      {!editing && card.sourceSectionId && (
        <div className="mt-2 border-t border-border pt-2">
          <SourceButton sectionId={card.sourceSectionId} quote={card.sourceQuote} page={card.sourcePage} heading={card.sourceHeading} />
        </div>
      )}
    </li>
  );
}

const PAGE = 50;

export function DeckEditor({ deckId, initialCards }: { deckId: string; initialCards: EditorCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [filter, setFilter] = useState<"all" | "verify" | string>(initialCards.some((c) => c.needsVerification) ? "verify" : "all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [merging, setMerging] = useState(false);
  const [busy, setBusy] = useState(false);

  const toVerify = cards.filter((c) => c.needsVerification).length;
  const visible = useMemo(() => {
    const needle = q.toLowerCase();
    return cards.filter((c) => (filter === "all" ? true : filter === "verify" ? c.needsVerification : c.cardType === filter) && (!needle || c.question.toLowerCase().includes(needle) || c.answer.toLowerCase().includes(needle)));
  }, [cards, filter, q]);
  const sel = [...selected].filter((id) => cards.some((c) => c.id === id));

  const update = (c: EditorCard) => setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...c } : x)));

  async function bulk(action: string, extra: Record<string, unknown> = {}) {
    if (!sel.length) return;
    setBusy(true);
    try {
      const r = await api<{ count: number }>("/api/cards/bulk", { body: { ids: sel, action, ...extra } });
      if (action === "delete") setCards((cs) => cs.filter((c) => !sel.includes(c.id)));
      else if (action === "verify") setCards((cs) => cs.map((c) => (sel.includes(c.id) ? { ...c, needsVerification: false } : c)));
      else if (action === "difficulty") setCards((cs) => cs.map((c) => (sel.includes(c.id) ? { ...c, difficulty: String(extra.difficulty) } : c)));
      else if (action === "type") setCards((cs) => cs.map((c) => (sel.includes(c.id) ? { ...c, cardType: String(extra.cardType) } : c)));
      else if (action === "suspend" || action === "unsuspend") setCards((cs) => cs.map((c) => (sel.includes(c.id) ? { ...c, suspended: action === "suspend" } : c)));
      setSelected(new Set());
      toast.success(`${r.count} card${r.count === 1 ? "" : "s"} updated.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  const typeCounts = cards.reduce<Record<string, number>>((m, c) => ((m[c.cardType] = (m[c.cardType] ?? 0) + 1), m), {});
  const mergeCards = cards.filter((c) => sel.includes(c.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter cards" className="flex flex-wrap gap-1.5">
          <button role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")} className={cn("rounded-full px-3 py-1 text-sm", filter === "all" ? "bg-fg text-bg" : "bg-surface-2 text-muted")}>
            All {cards.length}
          </button>
          <button role="tab" aria-selected={filter === "verify"} onClick={() => setFilter("verify")} className={cn("rounded-full px-3 py-1 text-sm", filter === "verify" ? "bg-warning text-white" : "bg-warning-soft text-warning")}>
            Needs verification {toVerify}
          </button>
          {Object.entries(typeCounts).map(([t, n]) => (
            <button key={t} role="tab" aria-selected={filter === t} onClick={() => setFilter(t)} className={cn("rounded-full px-3 py-1 text-sm", filter === t ? "bg-fg text-bg" : "bg-surface-2 text-muted")}>
              {TYPE_LABELS[t] ?? t} {n}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter cards…" aria-label="Filter cards by text" className="h-9 sm:w-56" />
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)} className="h-9">
            <Plus /> Add card
          </Button>
        </div>
      </div>

      {sel.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft p-2.5 text-sm">
          <span className="px-1 font-medium">{sel.length} selected</span>
          <Button size="sm" variant="secondary" onClick={() => bulk("verify")} disabled={busy}>
            Mark verified
          </Button>
          <Select aria-label="Set difficulty" className="h-8 w-auto" value="" onChange={(e) => e.target.value && bulk("difficulty", { difficulty: e.target.value })}>
            <option value="">Difficulty…</option>
            {["basic", "intermediate", "advanced", "expert"].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Select aria-label="Change type" className="h-8 w-auto" value="" onChange={(e) => e.target.value && bulk("type", { cardType: e.target.value })}>
            <option value="">Type…</option>
            {Object.entries(TYPE_LABELS)
              .filter(([k]) => k !== "cloze")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => bulk("suspend")} disabled={busy}>
            Suspend
          </Button>
          {sel.length >= 2 && sel.length <= 6 && (
            <Button size="sm" variant="secondary" onClick={() => setMerging(true)}>
              Merge
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => bulk("delete")} disabled={busy}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">{filter === "verify" ? "Nothing needs verification. Every card was checked against its source with good confidence." : "No cards match."}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1 text-sm text-muted">
            <Checkbox
              aria-label="Select all visible"
              checked={visible.slice(0, limit).every((c) => selected.has(c.id))}
              onCheckedChange={(v) => setSelected(v === true ? new Set(visible.slice(0, limit).map((c) => c.id)) : new Set())}
            />
            Select all shown
          </div>
          <ul className="space-y-3">
            {visible.slice(0, limit).map((c) => (
              <CardRow
                key={c.id}
                card={c}
                selected={selected.has(c.id)}
                onSelect={(v) => setSelected((s) => {
                  const n = new Set(s);
                  if (v) n.add(c.id);
                  else n.delete(c.id);
                  return n;
                })}
                onChange={update}
                onRemove={() => setCards((cs) => cs.filter((x) => x.id !== c.id))}
                onReplace={(newCards) => setCards((cs) => cs.flatMap((x) => (x.id === c.id ? newCards : [x])))}
              />
            ))}
          </ul>
          {visible.length > limit && (
            <div className="text-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Show more ({visible.length - limit} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title="Add a card">
          <CardForm
            onCancel={() => setAdding(false)}
            onSave={async (v) => {
              try {
                const r = await api<{ card: EditorCard }>(`/api/decks/${deckId}/cards`, { body: v });
                setCards((cs) => [r.card, ...cs]);
                setAdding(false);
                setFilter("all");
                toast.success("Card added.");
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : "Couldn't add the card.");
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={merging} onOpenChange={setMerging}>
        <DialogContent title={`Merge ${mergeCards.length} cards`} description="Write the combined card. The first card's source link and review history are kept.">
          <CardForm
            initial={{ question: mergeCards[0]?.question ?? "", answer: mergeCards.map((c) => c.answer).join(" "), cardType: "basic", difficulty: mergeCards[0]?.difficulty }}
            onCancel={() => setMerging(false)}
            onSave={async (v) => {
              try {
                const r = await api<{ card: EditorCard }>("/api/cards/merge", { body: { ids: mergeCards.map((c) => c.id), question: v.question, answer: v.answer } });
                setCards((cs) => cs.filter((c) => !sel.includes(c.id) || c.id === r.card.id).map((c) => (c.id === r.card.id ? { ...c, ...r.card } : c)));
                setSelected(new Set());
                setMerging(false);
                toast.success("Cards merged.");
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : "Couldn't merge.");
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
