import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Prose } from "@/components/marketing/prose";

export const metadata: Metadata = { title: "Features", description: "Source-grounded flashcards, verification, FSRS spaced repetition, exam mode, AI tutor and exports." };

export default function FeaturesPage() {
  return (
    <Prose title="What the app actually does" intro="A plain description of each part of the product, including what it doesn't do yet.">
      <h2>Document intelligence</h2>
      <p>PDF, Word, PowerPoint, EPUB and plain text are parsed into sections with page numbers. Running headers, footers and page numbers are removed; footnotes are kept because they often matter in academic writing. Reference lists are detected and excluded from card generation.</p>
      <p>Scanned PDFs (images of pages) can't be read yet — OCR is planned. If a PDF has no selectable text, you'll get a clear message instead of an empty deck.</p>
      <h2>Concept map and importance ranking</h2>
      <p>The document is analysed section by section to find definitions, theories, scholars, processes, causal links, comparisons and evidence. Each concept gets an importance score (0–100) based on what the model judges central plus signals from the whole document: headings, repetition across sections, explicit definitions and links to other concepts.</p>
      <h2>Cards grounded in the source</h2>
      <ul>
        <li>Each card is written to test one idea and to make sense without the book open.</li>
        <li>The supporting passage is located in the extracted text itself — the page number comes from where the passage sits in your file, not from the AI.</li>
        <li>A second, independent check compares every answer with its passage. Unsupported cards are discarded. Uncertain ones are marked “Review recommended” and grouped under Needs verification.</li>
        <li>Near-duplicate questions are removed using semantic similarity.</li>
      </ul>
      <h2>Editing and AI improvements</h2>
      <p>Edit, delete, merge, split or add cards. Per-card AI actions (make easier, harder, shorter, more precise, cloze, application or exam question, split) rewrite only that card and re-check it against the source.</p>
      <h2>Spaced repetition</h2>
      <p>Scheduling uses FSRS, a modern memory model that tracks each card&apos;s stability and difficulty and schedules the next review for when your predicted recall drops to your target retention (90% by default, adjustable). Mastery is calculated from that model — not from how many cards you&apos;ve seen.</p>
      <h2>Exam mode, oral mode and the tutor (Pro)</h2>
      <p>Exam mode asks open questions — explanations, comparisons, analysis, scenarios — and grades your answer on accuracy, completeness, terminology and reasoning, listing what you missed. Oral mode works the same way with speech input (in browsers that support it) and asks a follow-up like an examiner would. The tutor answers questions with citations to your document and labels anything that comes from outside it.</p>
      <h2>Planning and analytics</h2>
      <p>Set an exam date and you get a day-by-day workload that spreads new cards before a review buffer and redistributes missed days automatically. Analytics show review volume, recall rate, retention estimate and your strongest and weakest topics.</p>
      <h2>Exports</h2>
      <p>Anki package (.apkg), CSV (Front, Back, Source, Tags), Quizlet-compatible text, plain text and a printable layout you can save as PDF. You can also import CSV or TSV cards.</p>
      <div className="pt-6">
        <Button asChild>
          <Link href="/signup">Try it on your own material</Link>
        </Button>
      </div>
    </Prose>
  );
}
