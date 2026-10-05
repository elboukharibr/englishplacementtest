import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/app/auth-forms";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function Page() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <SignupForm googleEnabled={features.google()} />;
}
