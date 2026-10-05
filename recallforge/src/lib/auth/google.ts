import { Google } from "arctic";
import { env } from "@/lib/env";

export function googleClient(): Google | null {
  if (!env.googleClientId || !env.googleClientSecret) return null;
  return new Google(env.googleClientId, env.googleClientSecret, `${env.appUrl}/api/auth/google/callback`);
}
