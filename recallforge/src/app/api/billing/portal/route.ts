import { withUser, ok, jsonError } from "@/lib/api";
import { createPortalSession } from "@/lib/billing/stripe";
import { features } from "@/lib/env";

export const POST = withUser(async (_req, user) => {
  if (!features.stripe()) return jsonError("Payments aren't configured on this server yet.", 503, "billing_unconfigured");
  return ok({ url: await createPortalSession(user) });
});
