import type { Metadata } from "next";
import { LegalNotice, Prose } from "@/components/marketing/prose";

export const metadata: Metadata = { title: "AI Use Disclosure" };

export default function Page() {
  return (
    <Prose title="How we use AI" updated="To be set at launch">
      <LegalNotice />
      <h2>What AI does here</h2>
      <ul>
        <li>Identifies concepts in your documents and estimates their importance.</li>
        <li>Writes study cards and exam questions from your text.</li>
        <li>Checks each card&apos;s answer against the source passage and assigns a confidence level.</li>
        <li>Grades written and spoken exam answers, and powers the tutor.</li>
      </ul>
      <h2>Safeguards</h2>
      <p>Every card must point to a passage that exists in your document; page numbers are derived from your file, not generated. Cards that fail the independent check are discarded; uncertain cards are flagged. The tutor separates information from your document from general knowledge.</p>
      <h2>Limitations</h2>
      <p>AI can misread complex arguments, tables, formulas and figures. Grades are guidance, not an official assessment. Always verify material you will be examined on.</p>
      <h2>Providers and your data</h2>
      <p>Text from your documents is sent to the AI provider configured by the operator of this service (for example Anthropic or OpenAI) solely to produce your study material. Whether the provider retains or uses API data is governed by that provider&apos;s commercial terms; the operator must confirm those terms before stating anything stronger here. We do not use your documents to train models.</p>
    </Prose>
  );
}
