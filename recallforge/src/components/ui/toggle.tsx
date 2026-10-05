"use client";
import * as React from "react";
import * as C from "@radix-ui/react-checkbox";
import * as S from "@radix-ui/react-switch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: C.CheckboxProps) {
  return (
    <C.Root className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-fg", className)} {...props}>
      <C.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
}

export function Switch({ className, ...props }: S.SwitchProps) {
  return (
    <S.Root className={cn("relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors data-[state=checked]:bg-primary", className)} {...props}>
      <S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </S.Root>
  );
}
