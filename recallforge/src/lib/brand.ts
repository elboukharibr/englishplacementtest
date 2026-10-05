// Single place to rename the product. Everything user-facing reads from here.
export const BRAND = {
  name: "RecallForge",
  tagline: "Turn textbooks into mastery.",
  description:
    "Upload textbooks, lecture notes, or research papers and turn them into source-grounded active-recall decks with adaptive spaced repetition.",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@example.com",
} as const;
