import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm text-muted">404</p>
      <h1 className="font-serif text-3xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-muted">It may have been deleted, or the link is wrong.</p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
