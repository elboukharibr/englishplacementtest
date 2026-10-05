import type { Metadata } from "next";
import { ResetForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetForm token={token ?? ""} />;
}
