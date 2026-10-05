import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { env, features } from "@/lib/env";
import { PricingClient } from "@/components/marketing/pricing-client";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Pricing", description: "Free and Pro plans. Pro is $15/month or $120/year." };

const faq = [
  ["Is Pro unlimited?", "No. Pro has generous monthly limits (25 documents, 2,000 AI cards). AI generation has a real cost per card, and we'd rather be upfront about limits than quietly throttle you."],
  ["What happens to my cards if I cancel?", "You keep every deck, card and review history. You return to the Free plan's limits for new AI generation."],
  ["Can I export my decks?", "Yes. CSV, Quizlet-compatible text and plain text on every plan; Anki .apkg packages on Pro."],
  ["Do you train AI models on my documents?", "We don't. Documents are sent to our AI provider only to generate your study material. See the AI use disclosure for the provider's data terms."],
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-center font-serif text-4xl font-semibold tracking-tight">Spend your time learning, not making flashcards.</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">Start free. Upgrade when your reading list gets serious.</p>
      {sp.checkout === "cancelled" && (
        <Alert tone="info" className="mx-auto mt-8 max-w-xl" title="Checkout cancelled">
          No payment was taken. You can upgrade any time.
        </Alert>
      )}
      <div className="mt-12">
        <PricingClient signedIn={Boolean(user)} plan={user?.plan} stripeEnabled={features.stripe()} devBilling={env.allowDevBilling} />
      </div>
      <div className="mx-auto mt-20 max-w-3xl">
        <h2 className="font-serif text-2xl font-semibold">Questions</h2>
        <dl className="mt-6 divide-y divide-border">
          {faq.map(([q, a]) => (
            <div key={q} className="py-5">
              <dt className="font-medium">{q}</dt>
              <dd className="mt-2 text-sm text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
