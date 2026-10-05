import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";
import { googleClient } from "@/lib/auth/google";
import { env } from "@/lib/env";

export async function GET() {
  const google = googleClient();
  if (!google) return NextResponse.redirect(`${env.appUrl}/login?error=google_unconfigured`);
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  const jar = await cookies();
  const opts = { httpOnly: true, secure: env.isProd, sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("g_state", state, opts);
  jar.set("g_verifier", verifier, opts);
  return NextResponse.redirect(url);
}
