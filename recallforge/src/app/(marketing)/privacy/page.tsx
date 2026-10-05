import type { Metadata } from "next";
import { LegalNotice, Prose } from "@/components/marketing/prose";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <Prose title="Privacy Policy" updated="To be set at launch">
      <LegalNotice />
      <p>Your documents remain private and are used only to provide the service to you.</p>
      <h2>What we store</h2>
      <ul>
        <li>Account data: email, name, hashed password (or your Google account id), study preferences.</li>
        <li>Uploaded files and the text extracted from them, split into sections, plus numerical embeddings used for search.</li>
        <li>Generated study material: concepts, cards, short source quotes, review history and exam answers.</li>
        <li>Billing data handled by Stripe. We store your Stripe customer id and subscription status, never card numbers.</li>
        <li>Product usage events (for example “deck generated”, “review completed”) with counts and ids — never document text or card content.</li>
      </ul>
      <h2>Who processes your data</h2>
      <p>To generate study material, relevant text from your documents is sent to the AI provider configured for this service. The provider&apos;s own data-use and retention terms apply; see the AI use disclosure. File storage, database hosting, email and payments are handled by infrastructure providers acting on our behalf.</p>
      <h2>Your controls</h2>
      <ul>
        <li>Delete any document (file, extracted text and embeddings) from the library.</li>
        <li>Delete decks and individual cards.</li>
        <li>Remove all AI-generated data from Settings → Privacy.</li>
        <li>Delete your account, which removes all of the above and cancels any subscription.</li>
      </ul>
      <h2>Contact</h2>
      <p>Questions: {BRAND.supportEmail}</p>
    </Prose>
  );
}
