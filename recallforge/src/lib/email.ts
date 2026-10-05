import { env } from "@/lib/env";
import { BRAND } from "@/lib/brand";

type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Sends transactional email through Resend when RESEND_API_KEY is set.
 * Without a key (local development) the message is logged so links can be followed.
 */
export async function sendEmail(mail: Mail): Promise<{ delivered: boolean }> {
  if (!env.resendKey) {
    console.info(`[email:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return { delivered: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    console.error("[email] send failed", res.status, await res.text().catch(() => ""));
    return { delivered: false };
  }
  return { delivered: true };
}

export function verificationEmail(link: string): Omit<Mail, "to"> {
  return {
    subject: `Confirm your ${BRAND.name} email`,
    text: `Confirm your email address by opening this link:\n\n${link}\n\nThe link is valid for 48 hours. If you didn't create an account, you can ignore this message.`,
  };
}

export function resetEmail(link: string): Omit<Mail, "to"> {
  return {
    subject: `Reset your ${BRAND.name} password`,
    text: `Someone (hopefully you) asked to reset your password. Open this link to choose a new one:\n\n${link}\n\nThe link expires in 1 hour. If you didn't ask for this, ignore this email — your password stays the same.`,
  };
}
