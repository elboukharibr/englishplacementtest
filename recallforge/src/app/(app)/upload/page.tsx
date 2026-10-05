import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { limitsFor } from "@/lib/billing/plans";
import { getUsage } from "@/lib/billing/usage";
import { PageHeader, Alert } from "@/components/ui/misc";
import { Uploader } from "@/components/app/uploader";
import Link from "next/link";

export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireOnboardedUser();
  const { tab } = await searchParams;
  const limits = limitsFor(user.plan);
  const usage = await getUsage(user.id);
  const remaining = limits.documentsPerPeriod - usage.documents;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add study material" description={`Upload a chapter, paper, slides or notes. ${user.plan === "FREE" ? `Free plan: up to ${limits.pagesPerDocument} pages per document.` : `Up to ${limits.pagesPerDocument} pages per document.`}`} />
      {remaining <= 0 ? (
        <Alert tone="warning" title="You've used all your document uploads for this period." action={user.plan === "FREE" ? <Link className="text-primary underline" href="/pricing">See Pro</Link> : undefined}>
          Your allowance resets at the start of your next billing period. Existing documents can still be used to generate decks.
        </Alert>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {remaining} of {limits.documentsPerPeriod} uploads left this period.
          </p>
          <Uploader initialTab={tab === "paste" ? "paste" : "file"} maxMb={limits.maxUploadMb} />
        </>
      )}
    </div>
  );
}
