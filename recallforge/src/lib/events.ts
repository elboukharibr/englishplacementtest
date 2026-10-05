// Privacy-respecting product analytics: event names + ids/counts only, never document text.
import { db } from "@/lib/db";

export type ProductEventName =
  | "signup_completed"
  | "onboarding_completed"
  | "document_uploaded"
  | "document_processed"
  | "document_failed"
  | "deck_generated"
  | "study_started"
  | "study_completed"
  | "card_reviewed"
  | "exam_mode_started"
  | "oral_exam_started"
  | "tutor_used"
  | "export_used"
  | "paywall_seen"
  | "checkout_started"
  | "subscription_started"
  | "subscription_cancelled";

type Props = Record<string, string | number | boolean | null>;

export async function track(name: ProductEventName, userId: string | null, props?: Props) {
  try {
    await db.productEvent.create({ data: { name, userId, props: props ?? undefined } });
  } catch (e) {
    console.error("[events] failed", name, e);
  }
}
