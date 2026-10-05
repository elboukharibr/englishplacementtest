"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, CalendarDays, GraduationCap, Home, Layers, Library, Plus, RotateCcw, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const APP_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/decks", label: "Decks", icon: Layers },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/exam", label: "Exam Mode", icon: GraduationCap },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/study-plan", label: "Study Plan", icon: CalendarDays },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav({ dueCount }: { dueCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="App" className="flex flex-col gap-0.5">
      {APP_NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-fg")}
          >
            <n.icon className="size-4" />
            <span className="flex-1">{n.label}</span>
            {n.href === "/review" && dueCount > 0 && <span className="rounded-full bg-warning-soft px-2 text-xs font-medium text-warning">{dueCount}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

const MOBILE = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/decks", label: "Decks", icon: BookOpen },
  { href: "/upload", label: "Upload", icon: Plus, primary: true },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/search", label: "Search", icon: Search },
];

export function MobileNav({ dueCount }: { dueCount: number }) {
  const pathname = usePathname();
  if (pathname.startsWith("/study/")) return null; // immersive study mode
  return (
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {MOBILE.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-primary" : "text-muted")}>
                {n.primary ? (
                  <span className="-mt-1 rounded-full bg-primary p-2 text-primary-fg shadow">
                    <n.icon className="size-5" />
                  </span>
                ) : (
                  <n.icon className="size-5" />
                )}
                {n.label}
                {n.href === "/review" && dueCount > 0 && <span className="absolute right-[22%] top-1 rounded-full bg-warning px-1.5 text-[10px] font-semibold text-white">{dueCount > 99 ? "99+" : dueCount}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
