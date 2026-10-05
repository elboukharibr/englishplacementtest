# RecallForge

*Turn textbooks into mastery.*

RecallForge turns long academic documents (textbook chapters, lecture notes, slides, papers) into source-grounded active-recall cards and schedules them with spaced repetition. You upload a document. It is parsed, mapped into concepts and ranked by importance. Cards are written and then checked against the source text, and you review them with an FSRS scheduler that tracks mastery and weak topics.

The product name lives in one place (`src/lib/brand.ts`), so renaming it is a one-line change.

> This directory is a self-contained Next.js app. The rest of the repository (the English placement test in the root) is unrelated and untouched.

---

## What works today

| Area | Status |
|---|---|
| Email/password auth, sessions, email verification, password reset | ✅ (emails go to the server log if no `RESEND_API_KEY`) |
| Google sign-in | ✅ when `GOOGLE_CLIENT_ID/SECRET` are set; the button is hidden otherwise |
| Onboarding (study context, goal, exam date) + sample deck | ✅ |
| Upload PDF / DOCX / PPTX / EPUB / TXT / pasted text | ✅ magic-byte type check, size + page limits |
| Processing pipeline in background jobs with live status | ✅ |
| Concept extraction, importance ranking, analysis screen | ✅ |
| Card generation → grounding → dedup → verification → confidence | ✅ |
| Deck editor (edit, delete, add, merge, split, bulk, per-card AI improve) | ✅ |
| Study mode (keyboard, swipe, in-session relearning), FSRS scheduling | ✅ |
| Review queue, mastery categories, weak-topic practice | ✅ |
| Exam mode (written) and oral mode (speech-to-text in supporting browsers) | ✅ Pro |
| AI tutor with RAG + citations, streaming | ✅ Pro |
| Semantic search (pgvector) | ✅ (truly semantic only with `EMBEDDING_PROVIDER=openai`, see below) |
| Knowledge map | ✅ Pro |
| Analytics, study plan with exam countdown | ✅ (recall trend chart and study plan are Pro) |
| Exports: Anki `.apkg`, CSV, Quizlet, text, printable PDF | ✅ (`.apkg` is Pro) |
| Import CSV/TSV | ✅ (Anki `.apkg` import: not yet) |
| Stripe Checkout, Customer Portal, webhooks, billing history | ✅ code complete; needs your Stripe keys |
| Usage quotas per billing period, upsell dialog | ✅ |
| Admin dashboard (MRR/ARR, AI cost, contribution margin, retention, north star) | ✅ |
| Dark mode, mobile layout, keyboard navigation, reduced motion | ✅ |
| OCR for scanned PDFs | ❌ planned; scanned files fail with a clear message |
| Public/shared decks, collaboration, B2B | ❌ deliberately out of the MVP |

---

## Architecture

```
Browser ──▶ Next.js 15 (App Router, route handlers, server components)
              │   auth (DB sessions) · access checks · quotas · rate limits
              ├──▶ PostgreSQL + pgvector (Prisma)  ← all state, embeddings, job queue
              ├──▶ Storage driver: local disk | S3-compatible (R2, S3, Supabase)
              └──▶ Job queue (Postgres, SKIP LOCKED)
                        ▲ drained by: `npm run worker` | /api/cron/jobs | inline (dev)
                        │
                   Pipelines ──▶ AIProvider interface ──▶ Anthropic | OpenAI | Mock
                                 Embedder ─────────────▶ OpenAI | local hashing
Stripe ──webhook──▶ /api/billing/webhook  (signature-verified, idempotent)
```

### Main choices and why

- **One database for everything.** Postgres stores relational data, vectors (pgvector) and the job queue. That's one fewer service to deploy and keep in sync. The queue claims jobs with `FOR UPDATE SKIP LOCKED`, retries with exponential backoff, and recovers jobs whose worker died. If you outgrow it, the `enqueue`/handler split maps directly onto Trigger.dev, Inngest or BullMQ.
- **Own session auth instead of a hosted provider.** Sessions are opaque random tokens; only their SHA-256 is stored, so a database leak doesn't hand out live sessions. Passwords use bcrypt (cost 12). Google OAuth uses `arctic` with PKCE and state checks. I picked this over Auth.js because Auth.js v5 credentials login forces JWT sessions, and server-side revocation (logout everywhere, account deletion) matters here.
- **AI behind a task-level interface** (`src/lib/ai/types.ts`: `extractConcepts`, `generateCards`, `verifyCards`, `improveCard`, `generateQuestions`, `evaluateAnswer`, `summarizeSection`, `tutorStream`, …). Product code never imports a vendor SDK. `LLMProvider` implements the tasks once on top of a thin `LLMBackend` (Anthropic or OpenAI). The mock provider implements the same interface with text heuristics, so tests and local dev run offline.
- **Page numbers never come from the model.** Each chunk stores where every page starts inside its text. A card's supporting quote is located in the real text (exact, then fuzzy), and the page is read from that offset. A card whose quote can't be found is discarded.

### The generation pipeline (hallucination control)

`src/lib/pipeline/generate-deck.ts`:

1. **Select**: concepts matching the learner's focus, ranked by importance. Sections are weighted by the concepts they contain, and only as much source text as the deck size justifies is sent (≈450 tokens per card).
2. **Generate** candidate cards per batch of sections with the strong model, asking for ~30% more than needed. Output is structured JSON, validated with Zod on the server.
3. **Ground**: locate each card's verbatim quote in its section (or another section in the same batch). No match means the card is rejected.
4. **Deduplicate**: embedding similarity plus normalized-question equality.
5. **Verify**: a separate call with the cheaper model checks each answer against its passage: `supported` / `partially_supported` (with a correction) / `unsupported`. Unsupported cards are dropped.
6. **Score**: confidence = 0.5 × verifier + 0.3 × generator self-report + 0.2 × quote match quality, labelled High / Medium / Review recommended. "Review" cards land in the *Needs verification* filter.

The deck page shows the counts for every stage (candidates written, rejected, duplicates removed, flagged).

### Spaced repetition and mastery

- Scheduling uses **FSRS** via `ts-fsrs` (`src/lib/srs/fsrs.ts`), with a 10-minute learning step, fuzzing on, and each learner's target retention (default 90%, adjustable 80–95%). First intervals for a new card come out around Again 10m · Hard ~15m · Good ~2d · Easy ~9d, and later intervals adapt to the card's stability.
- **Card mastery** = current recall probability × durability, where durability is stability relative to 21 days. Cards still in (re)learning are capped at 50%. Deck mastery is the average, so it reflects review performance, not cards viewed.
- **Weak** = relearning, forgotten twice or more, or predicted recall under 70%. Weak topics group cards by concept/heading.

---

## Local setup

Requirements: Node 20+ (22 recommended) and PostgreSQL 15+ with the `pgvector` extension.

```bash
cd recallforge
npm install
cp .env.example .env          # then edit: DATABASE_URL, SESSION_SECRET, AI keys…

# database
createdb recallforge            # or via your Postgres host
npm run db:migrate              # applies prisma/migrations (creates the vector extension)
npm run db:seed                 # optional: demo@example.com / demo-password-1 with demo decks

npm run dev                     # http://localhost:3000
```

To try everything without any API keys:

```env
AI_PROVIDER="mock"
EMBEDDING_PROVIDER="local"
INLINE_JOBS="true"
ALLOW_DEV_BILLING="true"
```

The app shows a banner whenever the mock provider is active. Mock cards are produced by simple sentence heuristics, so they're useful for checking flows and useless for judging card quality.

### Development commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run worker` | Standalone job worker (use with `INLINE_JOBS=false`) |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit + integration tests (Vitest, uses the `recallforge_test` DB from `.env.test`) |
| `npm run test:e2e` | Playwright end-to-end tests (uses `recallforge_e2e`, starts its own dev server) |
| `npm run db:migrate:dev` | Create a new migration after editing `prisma/schema.prisma` |

---

## Configuration

Every variable is documented in `.env.example`. The ones that need decisions:

### AI provider

- `AI_PROVIDER=anthropic` (default) with `ANTHROPIC_API_KEY`. Card generation, exam questions and the tutor use `claude-opus-5-5`. Concept extraction, verification and grading use `claude-haiku-4-5`. Override with `AI_MODEL_GENERATE` / `AI_MODEL_FAST`. Server-side refusal fallback is enabled on models that support it.
- `AI_PROVIDER=openai` with `OPENAI_API_KEY`, `AI_MODEL_GENERATE` and `AI_MODEL_FAST` (both required, since no default model names are assumed).
- To add a provider (e.g. Gemini), implement `LLMBackend` (`structured` + `stream`) and register it in `src/lib/ai/index.ts`.

**Embeddings.** `EMBEDDING_PROVIDER=openai` (needs `OPENAI_API_KEY`) gives real semantic search and better deduplication. The default `local` embedder hashes words and word pairs. It needs no key, but it only captures shared vocabulary, so "What is X?" and "Define X." match while true paraphrases often won't. Vectors are 1536-dimensional. If you change dimensions, update the migration.

### Stripe setup

1. Create a product "Pro" with two recurring prices: $15/month and $120/year. Put the price ids in `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_YEARLY`.
2. Set `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint `${APP_URL}/api/billing/webhook` for: `checkout.session.completed`, `customer.subscription.created|updated|deleted|paused|resumed`, `invoice.paid`, `invoice.payment_failed`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
   Locally: `stripe listen --forward-to localhost:3000/api/billing/webhook`.
4. Enable the Customer Portal in the Stripe dashboard (cancellation, plan switching, payment method).

The plan is only ever written server-side, from Stripe objects. On the Checkout success redirect the server fetches the session from Stripe and syncs it, so Pro shows immediately even if the webhook is late. `past_due` keeps Pro during Stripe's retry window, and the user gets a notification.

### Storage setup

`STORAGE_DRIVER=s3` with `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, plus:
- Cloudflare R2: `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`
- Supabase Storage: `S3_ENDPOINT=https://<project>.supabase.co/storage/v1/s3`, region of your project
- AWS S3: leave `S3_ENDPOINT` empty (objects are written with SSE-AES256)

Keys are namespaced `users/<userId>/documents/<documentId>/original.<ext>`. The bucket should be private.

### Background jobs

Pick one:
- **Worker process** (recommended in production): `INLINE_JOBS=false` and run `npm run worker` on Railway, Fly.io, Render or a VM. Run more than one if you need throughput.
- **Serverless only (Vercel)**: `INLINE_JOBS=false`, set `CRON_SECRET`. `vercel.json` calls `/api/cron/jobs` every minute (each run drains for up to ~4.5 minutes; needs a plan that allows 300 s functions and per-minute crons) and `/api/cron/daily` for reminders.
- **Inline**: `INLINE_JOBS=true` processes jobs inside the web server. Fine for development or a single long-running Node server, but not for serverless.

---

## Deployment (Vercel + Supabase + R2 + Stripe)

1. Supabase: create a project, enable the `vector` extension, and copy the pooled connection string to `DATABASE_URL` and the direct one to `DIRECT_DATABASE_URL`.
2. R2 (or Supabase Storage): create a private bucket and S3 credentials.
3. Vercel: import the repo with **Root Directory = `recallforge`**, add all env vars, and set `APP_URL` to your domain.
4. Run migrations against production once: `DATABASE_URL=… DIRECT_DATABASE_URL=… npx prisma migrate deploy` (or add it to your release step).
5. Stripe webhook as above. Google OAuth redirect: `${APP_URL}/api/auth/google/callback`.
6. Choose a job mode (worker or cron).
7. Set `ADMIN_EMAILS`. Those accounts get `/admin`.

Each piece is replaceable: any Postgres with pgvector, any S3-compatible store, any Node host.

**Upload size on Vercel.** Vercel limits request bodies to ~4.5 MB, and uploads currently go through the app server. For larger PDFs on Vercel you need direct-to-storage presigned uploads. That isn't implemented yet (see Known limitations). On a regular Node host, the 15 MB (Free) / 50 MB (Pro) limits apply as configured.

---

## Security and privacy

- Every query for user content is scoped by `userId` (`src/lib/data/access.ts`). An integration test checks that another user can't read decks, cards, sections or search results.
- Mutating API routes reject cross-origin requests (Origin check). Cookies are httpOnly, SameSite=Lax, and Secure in production.
- Postgres-backed rate limits on login, signup, password reset, uploads, AI endpoints and search.
- Uploads: magic-byte detection (the extension and browser MIME type are not trusted), size limits, sanitized filenames, and storage keys built from ids only.
- Security headers (HSTS, frame denial, nosniff, referrer and permissions policy).
- CSV exports are guarded against spreadsheet formula injection.
- Users can delete documents (file, text, embeddings, concepts), decks, all AI-generated data, or their whole account (which also cancels Stripe subscriptions).
- Product analytics events (`ProductEvent`) contain ids and counts only, never document or card text.
- Copyright: no public sharing, and stored quotes are capped at ~300 characters. Extracted text is kept because RAG and the source viewer need it, and it is deleted with the document.

---

## AI cost: read this before setting prices

Rough per-deck estimate for **80 cards from a 60-page chapter** with the default models, at list prices ($4/$20 per M tokens for Opus 5.5, $1/$5 for Haiku 4.5):

| Step | Model | Approx. tokens | Approx. cost |
|---|---|---|---|
| Concept extraction (whole document, once) | Haiku | ~45k in / ~15k out | ~$0.12 |
| Card generation (~36k tokens of selected source) | Opus | ~40k in / ~15k out + thinking | ~$0.45–0.70 |
| Verification (each passage sent once per batch) | Haiku | ~45k in / ~5k out | ~$0.07 |
| **Total** | | | **≈ $0.65–0.90 per 80-card deck (≈1 ¢/card)** |

These are estimates from prompt sizes, **not measurements**. Run a few real documents and check `/admin` (every call is recorded with tokens and cost in `AiCall`).

The consequence: a Pro user who uses the whole 2,000-card allowance could cost about $16–22 in AI, more than the $15 they pay. Most users won't hit the cap, but the margin depends on that. Levers, roughly in order of impact:

1. Set `AI_MODEL_GENERATE=claude-sonnet-5-5` (about half the generation cost). Compare card quality on your own documents first.
2. Lower `cardsPerPeriod` for Pro in `src/lib/billing/plans.ts` (e.g. 1,000), or price long-document generation separately.
3. Prompt caching and the Batch API (50% off) for non-urgent generation. The prompts are already structured with stable system text, but neither is wired up yet.

Free users are capped at 100 cards a month (≈$1 at worst).

---

## Testing

- **Unit** (`tests/unit`): PDF/DOCX/text parsing, header/footer removal, chunking and page offsets, file-type detection, FSRS intervals and adaptation, mastery and weak detection, plan limits, AI schema validation, grounding (exact, fuzzy, rejection), importance scoring, embeddings, CSV/Quizlet/text export, `.apkg` (re-opened with SQLite), CSV/TSV import, and verbatim checks on sample-deck quotes.
- **Integration** (`tests/integration`, real Postgres): upload → processing → concepts → deck generation with grounding assertions; page-limit failure without retry; quotas and billing periods; concurrent usage counters; cross-user access control and search isolation; review → scheduling → weak queue; Stripe webhook upgrade/idempotency/downgrade and bad signatures.
- **End-to-end** (`tests/e2e`, Playwright against the running app):
  - `acceptance.spec.ts` covers the "Sarah" scenario: landing → signup → onboarding (exam prep, exam date) → upload a 60-page PDF → the Free plan's 30-page limit → upgrade to Pro (development billing) with Pro status visible immediately → retry processing → analysis → 80 advanced cards → edit one card, delete one → view highlighted source → study 20 cards with all four ratings → log out, time passes, log back in → due cards → weak-topic practice → `.apkg` + CSV export → generate another deck as Pro → analytics and study plan.
  - `free-limits.spec.ts`: Free-plan locks and the quota state.
  - `mobile.spec.ts`: phone viewport, bottom navigation, study with tap ratings, no horizontal scroll.

  Note on ordering: in the original scenario Sarah meets the free-plan limit near the end. With the Free limits in this spec (30 pages per document), a 60-page PDF hits the limit at upload, so the test upgrades at that point and then continues the remaining steps on Pro.

The E2E suite uses the mock AI provider and development billing. It proves the flows, not the quality of real model output or the real Stripe Checkout page.

---

## Known limitations

- **Scanned PDFs**: no OCR yet. They fail with an explanatory message. Tables and formulas come through as plain text, so their cards may be weaker.
- **Large uploads on Vercel**: presigned direct-to-storage uploads aren't implemented (see Deployment).
- **Local embeddings are lexical**: semantic search and paraphrase dedup need `EMBEDDING_PROVIDER=openai`.
- **Page numbers** are exact for PDF and PPTX (slide numbers). DOCX and text use estimated pages (~500 words), and EPUB uses chapter numbers. The UI says so.
- **Heading detection in PDFs** relies on font size and numbering patterns. Unusual layouts (two columns, headings in body-size bold) can merge sections.
- **Oral mode** uses the browser's Web Speech API (Chrome, Edge, Safari). Firefox users type their answers. No audio leaves the browser except as transcribed text.
- **Anki export** creates new cards without carrying over review history. `.apkg` import isn't available.
- **Revenue metrics** in `/admin` are computed from active subscriptions at list price (no discounts or taxes). Use Stripe for accounting.
- **Email reminders** need `RESEND_API_KEY`. Without it, in-app notifications still work.
- **Legal pages** are placeholders and must be reviewed by a lawyer before launch. The AI disclosure deliberately makes no claim about provider data retention until you've confirmed your provider's terms.
- **Not load-tested.** Indexes cover the hot paths (due queue, vector search, sessions), but no performance benchmarks have been run.
