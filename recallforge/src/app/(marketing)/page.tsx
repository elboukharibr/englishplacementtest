import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarCheck2, FileSearch, GraduationCap, Layers3, MessagesSquare, PenLine, Quote, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransformDemo } from "@/components/marketing/transform-demo";
import { PricingCards } from "@/components/marketing/pricing-cards";

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-success" /> Every card links back to the page it came from
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Turn textbooks into mastery.</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Upload your notes, textbooks, or research papers and turn them into active-recall and spaced-repetition decks in minutes — with a source citation on every card.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Create your first deck <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted">Free plan available. No credit card needed.</p>
        </div>
        <TransformDemo />
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-tight">Studying shouldn&apos;t mean spending hours preparing to study.</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Reading a chapter, finding what matters, rewriting it as questions, organising cards, deciding what to review — most of that is clerical work. It eats the time you should spend recalling and understanding.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: PenLine, title: "Stop writing flashcards manually", body: "The important definitions, mechanisms and arguments are pulled out for you, one idea per card." },
              { icon: BookOpenCheck, title: "Stop rereading entire chapters", body: "Rereading feels productive but tests nothing. Practise retrieving the material instead." },
              { icon: CalendarCheck2, title: "Stop guessing what to review", body: "Spaced repetition schedules each card for the moment you're about to forget it." },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-border bg-bg p-6">
                <c.icon className="size-5 text-primary" />
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm text-muted">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            { n: 1, title: "Upload", body: "Drop in a textbook chapter, lecture notes, slides or a research paper. PDF, Word, PowerPoint, EPUB or plain text." },
            { n: 2, title: "Generate", body: "We map the document's concepts, rank them by importance, and write cards grounded in the text. Each answer is checked against its source before you see it." },
            { n: 3, title: "Master", body: "Review with adaptive spaced repetition. Weak topics surface on their own, and exam mode tests you with open questions." },
          ].map((s) => (
            <div key={s.n} className="relative pl-12">
              <span className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">{s.n}</span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Differentiators */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-tight">Built for material you can&apos;t afford to get wrong</h2>
          <p className="mt-3 max-w-2xl text-muted">A chatbot with a PDF uploader will happily invent things. The parts below exist to stop that and to keep your study time on the cards that matter.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Quote, title: "Source-grounded cards", body: "Each card stores the passage that supports it. Tap “View source” to see the highlighted text and page." },
              { icon: ShieldCheck, title: "Verification and confidence", body: "Answers are checked against the source by a second pass. Unsupported cards are dropped; uncertain ones are flagged for you to review." },
              { icon: Target, title: "Importance ranking", body: "Concepts are scored by how central they are — headings, definitions, repeated emphasis — so cards go where the marks are." },
              { icon: Layers3, title: "Adaptive scheduling (FSRS)", body: "A modern memory model estimates each card's stability and schedules reviews to hit your target retention." },
              { icon: GraduationCap, title: "Exam and oral modes", body: "Write or speak full answers. Get scored on accuracy, completeness, terminology and reasoning, plus a follow-up question." },
              { icon: MessagesSquare, title: "A tutor that cites your text", body: "Ask for an explanation or an example. Answers cite your document and say clearly when they go beyond it." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-bg p-6">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild variant="secondary">
              <Link href="/features">
                <FileSearch /> All features
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Social proof placeholder — no invented testimonials */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <h2 className="font-serif text-xl font-semibold">Student testimonials coming soon</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">We&apos;d rather show real feedback than invent it. If you use the app and want to share how it went, we&apos;d like to hear from you.</p>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-serif text-3xl font-semibold tracking-tight">Spend your time learning, not making flashcards.</h2>
        <div className="mt-10">
          <PricingCards />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-3xl bg-primary px-8 py-12 text-center text-primary-fg">
          <h2 className="font-serif text-3xl font-semibold">Stop making flashcards. Start learning.</h2>
          <p className="mx-auto mt-3 max-w-xl opacity-90">Upload one chapter and see what you get. The free plan covers two documents a month.</p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link href="/signup">Start studying free</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
