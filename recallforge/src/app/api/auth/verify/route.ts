import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = token ? await consumeToken(token, "EMAIL_VERIFY") : null;
  if (!userId) return NextResponse.redirect(`${env.appUrl}/verify-email?status=invalid`);
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return NextResponse.redirect(`${env.appUrl}/verify-email?status=ok`);
}
