import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/marketing/prose";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "For exam candidates", description: "A study plan built from your exam date, deck size and real recall performance." };

export default function Page() {
  return (
    <Prose title="For competitive-exam and certification candidates" intro="You know the date. The question is how much to review each day to arrive ready.">
      <p>Enter your exam date and the app works backwards: new cards are introduced early enough to be reviewed several times, the last days are kept for review only, and if you miss a day the backlog is spread over the next three instead of landing on you all at once.</p>
      <p>Exam mode (Pro) moves past recognition. You write — or say — a full answer and get it scored on accuracy, completeness, terminology and reasoning, with the concepts you left out listed explicitly.</p>
      <h2>What it won&apos;t do</h2>
      <p>It doesn&apos;t know your exam&apos;s syllabus unless your documents contain it, and it can&apos;t predict questions. It helps you remember and explain what&apos;s in your material.</p>
      <Button asChild className="mt-4">
        <Link href="/signup">Build my study plan</Link>
      </Button>
    </Prose>
  );
}
