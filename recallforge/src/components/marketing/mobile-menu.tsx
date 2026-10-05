"use client";
import Link from "next/link";
import { Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";

export function MobileMenu({ items, signedIn }: { items: { href: string; label: string }[]; signedIn: boolean }) {
  return (
    <div className="md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {items.map((i) => (
            <DropdownMenuItem key={i.href} asChild>
              <Link href={i.href}>{i.label}</Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Open app" : "Log in"}</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
