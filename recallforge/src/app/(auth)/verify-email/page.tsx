import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verify email" };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">Email verification</h1>
      {status === "ok" ? (
        <Alert tone="success" title="Your email is verified">
          Thanks — you&apos;re all set.
        </Alert>
      ) : (
        <Alert tone="danger" title="This link is invalid or has expired">
          Request a new verification email from the banner in the app.
        </Alert>
      )}
      <Button asChild className="w-full">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
