// Native Anki package (.apkg) writer: a zip containing a SQLite collection (schema v11)
// and an empty media map. Cards are exported as new cards in a Basic(+Source) note type.
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { frontBack, sourceLabel, type ExportCard } from "./formats";

// Pure-JS build of SQLite (no .wasm file to locate at runtime).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require("sql.js/dist/sql-asm.js") as (cfg?: object) => Promise<{ Database: new () => SqlDb }>;
type SqlDb = { run(sql: string, params?: unknown[]): void; export(): Uint8Array; close(): void };

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);`;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stableId(seed: string): number {
  // Deterministic positive 13-digit id so re-imports update instead of duplicating.
  const h = createHash("sha1").update(seed).digest();
  return 1_000_000_000_000 + (h.readUInt32BE(0) % 8_999_999_999);
}

function checksum(field: string): number {
  const stripped = field.replace(/<[^>]+>/g, "");
  return parseInt(createHash("sha1").update(stripped).digest("hex").slice(0, 8), 16);
}

export async function buildApkg(opts: { deckId: string; deckName: string; documentTitle?: string | null; cards: (ExportCard & { id: string })[] }): Promise<Buffer> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(SCHEMA);
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const did = stableId(`deck:${opts.deckId}`);
  const mid = stableId("model:recallforge-basic-source-v1");

  const model = {
    id: mid,
    name: "RecallForge Basic (with source)",
    type: 0,
    mod: nowSec,
    usn: -1,
    sortf: 0,
    did,
    tmpls: [
      {
        name: "Card 1",
        ord: 0,
        qfmt: "{{Front}}",
        afmt: '{{FrontSide}}<hr id=answer>{{Back}}{{#Source}}<div class="source">{{Source}}</div>{{/Source}}',
        did: null,
        bqfmt: "",
        bafmt: "",
      },
    ],
    flds: ["Front", "Back", "Source"].map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: "Arial", size: 20, media: [] })),
    css: ".card{font-family:Georgia,serif;font-size:20px;text-align:left;color:#14213d;background:#faf8f4;max-width:42em;margin:auto;line-height:1.5}.source{margin-top:1.2em;font-size:13px;color:#64748b}",
    latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
    tags: [],
    vers: [],
    req: [[0, "any", [0]]],
  };
  const deckBase = { mod: nowSec, usn: -1, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0], collapsed: false, browserCollapsed: false, desc: "", dyn: 0, conf: 1, extendNew: 0, extendRev: 0 };
  const decks = {
    "1": { ...deckBase, id: 1, name: "Default" },
    [did]: { ...deckBase, id: did, name: opts.deckName.replace(/::/g, ":"), desc: opts.documentTitle ? `Generated from: ${escapeHtml(opts.documentTitle)}` : "" },
  };
  const dconf = {
    "1": {
      id: 1, name: "Default", mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
      new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
      rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
      lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
    },
  };
  const conf = { activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true, curModel: mid, nextPos: opts.cards.length + 1, sortType: "noteFld", sortBackwards: false, addToCur: true };

  db.run("INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')", [
    nowSec, now, now, JSON.stringify(conf), JSON.stringify({ [mid]: model }), JSON.stringify(decks), JSON.stringify(dconf),
  ]);

  opts.cards.forEach((c, i) => {
    const { front, back } = frontBack(c);
    const fields = [escapeHtml(front), escapeHtml(back), escapeHtml(sourceLabel(c, opts.documentTitle))];
    const nid = stableId(`note:${c.id}`);
    const cid = stableId(`card:${c.id}`);
    const tags = [...c.tags, c.cardType].filter(Boolean).map((t) => t.replace(/\s+/g, "_"));
    db.run("INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')", [
      nid, c.id.slice(0, 20), mid, nowSec, tags.length ? ` ${tags.join(" ")} ` : "", fields.join("\x1f"), fields[0], checksum(fields[0]),
    ]);
    db.run("INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')", [cid, nid, did, nowSec, i + 1]);
  });

  const bytes = db.export();
  db.close();
  const zip = new JSZip();
  zip.file("collection.anki2", bytes);
  zip.file("media", "{}");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
