"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client";

export function VerifyBanner() {
  const [sent, setSent] = useState(false);
  return (
    <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm">
      Please confirm your email address.{" "}
      <button
        className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60"
        disabled={sent}
        onClick={async () => {
          try {
            const r = await api<{ delivered?: boolean }>("/api/auth/resend-verification", { body: {} });
            setSent(true);
            toast.success(r.delivered === false ? "Email delivery isn't configured — check the server log for the link." : "Verification email sent.");
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Couldn't send the email.");
          }
        }}
      >
        {sent ? "Sent" : "Resend link"}
      </button>
    </div>
  );
}
