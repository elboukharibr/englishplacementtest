import Link from "next/link";
import { Logo } from "@/components/logo";
import { BRAND } from "@/lib/brand";

const cols = [
  { title: "Product", links: [["/features", "Features"], ["/pricing", "Pricing"], ["/blog", "Blog"]] },
  { title: "Who it's for", links: [["/for-students", "University students"], ["/for-exam-candidates", "Exam candidates"], ["/for-researchers", "Researchers"]] },
  { title: "Legal", links: [["/privacy", "Privacy"], ["/terms", "Terms"], ["/cookies", "Cookies"], ["/ai-disclosure", "AI use"], ["/copyright", "Copyright & takedown"]] },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted">{BRAND.tagline} Spend your time learning, not preparing to learn.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="mb-3 text-sm font-semibold">{c.title}</h2>
            <ul className="space-y-2 text-sm text-muted">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-fg">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</div>
    </footer>
  );
}
