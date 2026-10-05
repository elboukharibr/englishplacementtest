import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "@/components/app/onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardedAt) redirect("/dashboard");
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <Logo className="mb-10" />
      <OnboardingForm firstName={user.name?.split(" ")[0] ?? null} />
    </main>
  );
}
