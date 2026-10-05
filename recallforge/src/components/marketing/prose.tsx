export function Prose({ title, intro, children, updated }: { title: string; intro?: string; children: React.ReactNode; updated?: string }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">{title}</h1>
      {intro && <p className="mt-4 text-lg text-muted">{intro}</p>}
      {updated && <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>}
      <div className="mt-10 space-y-6 leading-relaxed [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-fg/85 [&_ul]:space-y-2">{children}</div>
    </article>
  );
}

export function LegalNotice() {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
      <strong>Placeholder document.</strong> This text describes how the product works today, but it has not been reviewed by a lawyer. It must receive professional legal review before public launch.
    </div>
  );
}
