import type { Metadata } from "next";
import { ForgotForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return <ForgotForm />;
}
