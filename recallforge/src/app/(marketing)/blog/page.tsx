import type { Metadata } from "next";
import { Prose } from "@/components/marketing/prose";

export const metadata: Metadata = { title: "Blog", description: "Notes on retrieval practice, spaced repetition and studying from difficult texts." };

export default function BlogPage() {
  return (
    <Prose title="Blog" intro="Notes on retrieval practice, spaced repetition and learning from difficult texts.">
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">No posts yet. The first articles are being written.</div>
    </Prose>
  );
}
