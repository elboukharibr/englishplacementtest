"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Progress } from "@/components/ui/misc";
import { SourceButton } from "./source-viewer";
import { pct } from "@/lib/utils";

export type MapNode = { id: string; name: string; kind: string; summary: string; importance: number; sectionId: string | null; page: number | null; mastery: number | null; cards: { id: string; deckId: string; question: string }[] };
export type MapEdge = { from: string; to: string };

/** Deterministic force-directed layout (no randomness → stable between renders). */
function layout(nodes: MapNode[], edges: MapEdge[], w: number, h: number) {
  const pos = new Map(nodes.map((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    const r = 0.35 * Math.min(w, h) * (1 - n.importance / 200);
    return [n.id, { x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r }];
  }));
  for (let it = 0; it < 220; it++) {
    const force = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos.get(nodes[i].id)!, b = pos.get(nodes[j].id)!;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = Math.max(80, dx * dx + dy * dy);
        const f = 2600 / d2;
        const d = Math.sqrt(d2);
        force.get(nodes[i].id)!.x += (dx / d) * f; force.get(nodes[i].id)!.y += (dy / d) * f;
        force.get(nodes[j].id)!.x -= (dx / d) * f; force.get(nodes[j].id)!.y -= (dy / d) * f;
      }
    for (const e of edges) {
      const a = pos.get(e.from), b = pos.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 110) * 0.02;
      force.get(e.from)!.x += (dx / d) * f; force.get(e.from)!.y += (dy / d) * f;
      force.get(e.to)!.x -= (dx / d) * f; force.get(e.to)!.y -= (dy / d) * f;
    }
    for (const n of nodes) {
      const p = pos.get(n.id)!, f = force.get(n.id)!;
      p.x += Math.max(-8, Math.min(8, f.x + (w / 2 - p.x) * 0.004));
      p.y += Math.max(-8, Math.min(8, f.y + (h / 2 - p.y) * 0.004));
      p.x = Math.max(60, Math.min(w - 60, p.x));
      p.y = Math.max(30, Math.min(h - 30, p.y));
    }
  }
  return pos;
}

export function KnowledgeMap({ nodes, edges }: { nodes: MapNode[]; edges: MapEdge[] }) {
  const W = 900, H = 560;
  const pos = useMemo(() => layout(nodes, edges, W, H), [nodes, edges]);
  const [selected, setSelected] = useState<string | null>(nodes[0]?.id ?? null);
  const sel = nodes.find((n) => n.id === selected);
  const neighbours = new Set(edges.filter((e) => e.from === selected || e.to === selected).flatMap((e) => [e.from, e.to]));
  const color = (m: number | null) => (m == null ? "var(--muted)" : m >= 0.7 ? "var(--success)" : m >= 0.4 ? "var(--warning)" : "var(--danger)");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="overflow-x-auto rounded-3xl border border-border bg-surface">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px]" role="img" aria-label="Concept relationship map">
          {edges.map((e, i) => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            const hl = e.from === selected || e.to === selected;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hl ? "var(--primary)" : "var(--border)"} strokeWidth={hl ? 2 : 1.2} />;
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id)!;
            const r = 6 + n.importance / 10;
            const dim = selected && n.id !== selected && !neighbours.has(n.id);
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} opacity={dim ? 0.35 : 1} className="cursor-pointer" onClick={() => setSelected(n.id)} role="button" tabIndex={0} aria-label={n.name} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(n.id)}>
                <circle r={r} fill={color(n.mastery)} stroke={n.id === selected ? "var(--fg)" : "var(--surface)"} strokeWidth={n.id === selected ? 3 : 2} />
                <text y={r + 13} textAnchor="middle" fontSize="12" fill="var(--fg)" style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}>
                  {n.name.length > 26 ? n.name.slice(0, 25) + "…" : n.name}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-4 border-t border-border px-4 py-2 text-xs text-muted">
          <span>Size = importance</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-success" /> strong</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warning" /> building</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-danger" /> weak</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-muted" /> not studied</span>
        </div>
      </div>
      <aside className="rounded-3xl border border-border bg-surface p-5">
        {sel ? (
          <div className="space-y-4">
            <div>
              <Badge>{sel.kind.replace("_", " ")}</Badge>
              <h2 className="mt-2 font-serif text-xl font-semibold">{sel.name}</h2>
              <p className="mt-1 text-xs text-muted">Importance {sel.importance}/100{sel.page != null && ` · p. ${sel.page}`}</p>
            </div>
            <p className="text-sm">{sel.summary}</p>
            <SourceButton sectionId={sel.sectionId} quote={null} page={sel.page} heading={sel.name} />
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Mastery</span>
                <span>{sel.mastery == null ? "not studied" : pct(sel.mastery)}</span>
              </div>
              <Progress value={(sel.mastery ?? 0) * 100} tone="success" label="Concept mastery" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Related cards ({sel.cards.length})</p>
              {sel.cards.length ? (
                <ul className="space-y-1.5 text-sm">
                  {sel.cards.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <Link href={`/decks/${c.deckId}`} className="line-clamp-2 hover:text-primary">
                        {c.question.replace(/\{\{(.+?)\}\}/g, "[…]")}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No cards for this concept yet.</p>
              )}
            </div>
            {neighbours.size > 1 && (
              <div>
                <p className="mb-2 text-sm font-medium">Connected to</p>
                <div className="flex flex-wrap gap-1.5">
                  {nodes.filter((n) => neighbours.has(n.id) && n.id !== sel.id).map((n) => (
                    <button key={n.id} onClick={() => setSelected(n.id)} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs hover:bg-primary-soft">
                      {n.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Select a concept.</p>
        )}
      </aside>
    </div>
  );
}
