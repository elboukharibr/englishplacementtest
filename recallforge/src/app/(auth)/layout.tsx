import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-[var(--shadow)] sm:p-8">{children}</div>
    </main>
  );
}
