import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return ["", "/features", "/pricing", "/for-students", "/for-exam-candidates", "/for-researchers", "/blog", "/privacy", "/terms", "/cookies", "/ai-disclosure", "/copyright", "/signup", "/login"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p === "" || p === "/pricing" ? "weekly" : "monthly",
    priority: p === "" ? 1 : 0.6,
  }));
}
