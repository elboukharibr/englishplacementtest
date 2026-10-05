import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/library", "/decks", "/study", "/review", "/exam", "/analytics", "/study-plan", "/search", "/settings", "/admin", "/print", "/onboarding", "/upload"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
