import type { Metadata } from "next";
import { LegalNotice, Prose } from "@/components/marketing/prose";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function Page() {
  return (
    <Prose title="Cookie Policy" updated="To be set at launch">
      <LegalNotice />
      <p>We use only the cookies needed to run the service:</p>
      <ul>
        <li><code>rf_session</code> — keeps you signed in (httpOnly, 30 days).</li>
        <li><code>g_state</code>, <code>g_verifier</code> — short-lived (10 minutes) security cookies during Google sign-in.</li>
        <li>Your theme preference is stored in your browser&apos;s local storage.</li>
      </ul>
      <p>We don&apos;t use advertising or third-party tracking cookies. Stripe sets its own cookies on its checkout pages.</p>
    </Prose>
  );
}
