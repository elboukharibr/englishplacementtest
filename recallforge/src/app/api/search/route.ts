import { withUser, ok } from "@/lib/api";
import { search } from "@/lib/data/search";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = withUser(async (req, user) => {
  await enforceRateLimit(`search:${user.id}`, 120, 60);
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return ok(await search(user.id, q));
});
