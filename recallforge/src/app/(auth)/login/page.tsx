import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/app/auth-forms";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function Page() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <Suspense>
      <LoginForm googleEnabled={features.google()} />
    </Suspense>
  );
}
