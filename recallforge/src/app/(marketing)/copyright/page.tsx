import type { Metadata } from "next";
import { LegalNotice, Prose } from "@/components/marketing/prose";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Copyright & Takedown Policy" };

export default function Page() {
  return (
    <Prose title="Copyright and takedown" updated="To be set at launch">
      <LegalNotice />
      <p>Uploaded documents are private to the account that uploaded them. There is no public sharing of uploaded files or full texts. Cards store only short quotations (a sentence or two) so learners can check answers against their own copy.</p>
      <h2>Reporting infringement</h2>
      <p>If you believe material on the service infringes your copyright, email {BRAND.supportEmail} with: the work concerned, where it appears, your contact details, and a statement that you are the rights holder or authorised to act for them. We will review and respond promptly.</p>
    </Prose>
  );
}
