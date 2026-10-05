import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/marketing/prose";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "For researchers and PhD students", description: "Learn papers, theories and scholars for comprehensive exams, vivas and literature reviews." };

export default function Page() {
  return (
    <Prose title="For researchers and doctoral students" intro="Comprehensive exams and vivas reward knowing who argued what, and why it matters.">
      <p>Papers are dense with positions, methods and citations. The concept map pulls out scholars and their contributions, theoretical distinctions and methodological terms, and keeps a link from every card back to the paragraph it came from — useful when you need to cite precisely.</p>
      <p>Oral mode simulates an examiner: you explain a concept aloud, get feedback on what you omitted, then face a follow-up question.</p>
      <h2>Privacy</h2>
      <p>Unpublished drafts stay private to your account. Nothing is shared publicly, and you can delete a document, its extracted text and its AI-generated data at any time.</p>
      <Button asChild className="mt-4">
        <Link href="/signup">Upload a paper</Link>
      </Button>
    </Prose>
  );
}
