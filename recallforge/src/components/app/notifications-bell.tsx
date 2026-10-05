"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { api } from "@/lib/client";
import { formatRelative } from "@/lib/utils";

type N = { id: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

export function NotificationsBell() {
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    try {
      const r = await api<{ items: N[]; unread: number }>("/api/notifications");
      setItems(r.items);
      setUnread(r.unread);
    } catch {
      /* non-critical */
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  const markRead = async () => {
    if (!unread) return;
    setUnread(0);
    await api("/api/notifications", { body: {} }).catch(() => {});
  };
  return (
    <DropdownMenu onOpenChange={(o) => o && markRead()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"} className="relative">
          <Bell />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">Nothing new.</p>
        ) : (
          items.slice(0, 8).map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link href={n.href ?? "/dashboard"} className="flex flex-col items-start gap-0.5">
                <span className={n.readAt ? "text-fg/80" : "font-medium"}>{n.title}</span>
                {n.body && <span className="text-xs text-muted">{n.body}</span>}
                <span className="text-[11px] text-muted">{formatRelative(n.createdAt)}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings#notifications" className="text-xs text-muted">
            Notification settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
