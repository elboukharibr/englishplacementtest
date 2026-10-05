import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect x="3" y="7" width="20" height="20" rx="4" className="fill-primary/20" />
      <rect x="9" y="4" width="20" height="20" rx="4" className="fill-primary" />
      <path d="M14 14.5l3 3 6-6.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-[#0f1420]" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-serif text-lg font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>{BRAND.name}</span>
    </Link>
  );
}
