import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { decodeIdToken } from "arctic";
import { db } from "@/lib/db";
import { googleClient } from "@/lib/auth/google";
import { createSession, isAdmin } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { track } from "@/lib/events";

type GoogleClaims = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

export async function GET(req: NextRequest) {
  const google = googleClient();
  const jar = await cookies();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = jar.get("g_state")?.value;
  const verifier = jar.get("g_verifier")?.value;
  jar.delete("g_state");
  jar.delete("g_verifier");
  if (!google || !code || !state || !verifier || state !== storedState) {
    return NextResponse.redirect(`${env.appUrl}/login?error=google_failed`);
  }
  let claims: GoogleClaims;
  try {
    const tokens = await google.validateAuthorizationCode(code, verifier);
    claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
  } catch {
    return NextResponse.redirect(`${env.appUrl}/login?error=google_failed`);
  }
  if (!claims.email || !claims.email_verified) return NextResponse.redirect(`${env.appUrl}/login?error=google_unverified`);
  const email = claims.email.toLowerCase();
  let user = await db.user.findFirst({ where: { OR: [{ googleId: claims.sub }, { email }] } });
  let created = false;
  if (!user) {
    user = await db.user.create({ data: { email, name: claims.name, image: claims.picture, googleId: claims.sub, emailVerifiedAt: new Date() } });
    created = true;
  } else if (!user.googleId) {
    // Link Google to an existing email account (Google has verified the address).
    user = await db.user.update({ where: { id: user.id }, data: { googleId: claims.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date(), image: user.image ?? claims.picture } });
  }
  if (isAdmin(user) && user.role !== "ADMIN") await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  await createSession(user.id, (await headers()).get("user-agent"));
  if (created) await track("signup_completed", user.id, { method: "google" });
  return NextResponse.redirect(`${env.appUrl}${user.onboardedAt ? "/dashboard" : "/onboarding"}`);
}
