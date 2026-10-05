"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client";

function GoogleButton({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <>
      <Button asChild variant="secondary" className="w-full">
        <a href="/api/auth/google">
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
          </svg>
          Continue with Google
        </a>
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

const GOOGLE_ERRORS: Record<string, string> = {
  google_failed: "Google sign-in didn't complete. Please try again.",
  google_unverified: "Your Google account email isn't verified.",
  google_unconfigured: "Google sign-in isn't configured on this server.",
};

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(GOOGLE_ERRORS[params.get("error") ?? ""] ?? null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ redirect: string }>("/api/auth/login", { body: { email: fd.get("email"), password: fd.get("password") } });
      router.push(params.get("next")?.startsWith("/") ? params.get("next")! : r.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in.");
      setBusy(false);
    }
  }
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Log in to continue your reviews.</p>
      <GoogleButton enabled={googleEnabled} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFieldErr({});
    try {
      const r = await api<{ redirect: string }>("/api/auth/signup", { body: { name: fd.get("name"), email: fd.get("email"), password: fd.get("password") } });
      router.push(r.redirect);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const field = err.details?.field as string | undefined;
        if (field) setFieldErr({ [field]: err.message });
        else if (err.details?.issues) setFieldErr(Object.fromEntries((err.details.issues as { path: string; message: string }[]).map((i) => [i.path, i.message])));
        else setError(err.message);
      } else setError("Couldn't create your account.");
      setBusy(false);
    }
  }
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Free plan included. No credit card.</p>
      <GoogleButton enabled={googleEnabled} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Name" htmlFor="name" error={fieldErr.name}>
          <Input id="name" name="name" autoComplete="name" required aria-invalid={!!fieldErr.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={fieldErr.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fieldErr.email} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters, with a number or symbol." error={fieldErr.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!fieldErr.password} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
        <p className="text-center text-xs text-muted">
          By continuing you agree to the{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { body: { email: new FormData(e.currentTarget).get("email") } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold">Reset your password</h1>
      {sent ? (
        <Alert tone="success" className="mt-6" title="Check your inbox">
          If an account exists for that address, we&apos;ve sent a link to reset your password. It expires in one hour.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is incomplete. Request a new one.");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("confirm")) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ redirect: string }>("/api/auth/reset", { body: { token, password: fd.get("password") } });
      router.push(r.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reset your password.");
      setBusy(false);
    }
  }
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="New password" htmlFor="password" hint="At least 10 characters, with a number or symbol.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" className="w-full" loading={busy} disabled={!token}>
          Save password
        </Button>
      </form>
    </div>
  );
}
