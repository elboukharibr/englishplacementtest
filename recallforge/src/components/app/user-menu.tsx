"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Settings, Shield, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { api } from "@/lib/client";

export function UserMenu({ name, email, plan, admin }: { name: string | null; email: string; plan: string; admin: boolean }) {
  const router = useRouter();
  const initials = (name ?? email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-label="Account menu">
        {initials || <User className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium text-fg">{name ?? email}</span>
          <span className="block truncate font-normal">{email}</span>
          <span className="mt-1 inline-block rounded bg-surface-2 px-1.5 text-[11px]">{plan === "PRO" ? "Pro" : "Free plan"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/billing">
            <CreditCard /> Billing & usage
          </Link>
        </DropdownMenuItem>
        {admin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield /> Admin
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await api("/api/auth/logout", { body: {} }).catch(() => {});
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
