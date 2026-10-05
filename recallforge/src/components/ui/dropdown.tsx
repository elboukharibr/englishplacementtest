"use client";
import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn("z-50 min-w-[12rem] rounded-xl border border-border bg-surface p-1 shadow-lg", className)} {...props} />
    </M.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: M.DropdownMenuItemProps) {
  return <M.Item className={cn("flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted", className)} {...props} />;
}
export function DropdownMenuLabel({ className, ...props }: M.DropdownMenuLabelProps) {
  return <M.Label className={cn("px-2.5 py-1.5 text-xs font-medium text-muted", className)} {...props} />;
}
export function DropdownMenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />;
}
