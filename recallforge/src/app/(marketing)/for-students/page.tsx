import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/marketing/prose";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "For university students", description: "Turn weekly readings and lecture notes into review decks you can trust." };

export default function Page() {
  return (
    <Prose title="For university students" intro="When the reading list is longer than the week, preparation has to get cheaper.">
      <p>A typical week can mean three or four chapters across different courses. Most students either reread (which feels like progress but tests nothing) or spend evenings building flashcards by hand.</p>
      <p>Upload each reading as it&apos;s assigned. You get a deck organised by the chapter&apos;s own structure, with the definitions, mechanisms and authors your lecturer is likely to ask about. Review a little every day and the scheduler keeps older chapters alive while you add new ones.</p>
      <h2>Good fit</h2>
      <ul>
        <li>Humanities and social sciences with dense terminology and many authors</li>
        <li>Medicine, law and economics where definitions and distinctions carry the marks</li>
        <li>Slides and lecture notes you&apos;d otherwise reread the night before</li>
      </ul>
      <h2>Worth knowing</h2>
      <p>Cards are only as good as the source. Lecture slides with three words per bullet give thinner cards than a textbook chapter. Use the Needs verification view to check anything the system was unsure about.</p>
      <Button asChild className="mt-4">
        <Link href="/signup">Start with one chapter</Link>
      </Button>
    </Prose>
  );
}
