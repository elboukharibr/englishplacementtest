import { withPublic, ok } from "@/lib/api";
import { destroyCurrentSession } from "@/lib/auth/session";

export const POST = withPublic(async () => {
  await destroyCurrentSession();
  return ok({ ok: true, redirect: "/" });
});
