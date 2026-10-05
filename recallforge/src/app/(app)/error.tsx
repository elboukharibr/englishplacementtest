"use client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { TriangleAlert } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="This page couldn't load"
      description={`Something went wrong on our side${error.digest ? ` (ref ${error.digest})` : ""}. Your data is safe.`}
      action={
        <div className="flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>
            Go to dashboard
          </Button>
        </div>
      }
    />
  );
}
