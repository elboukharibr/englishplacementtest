import * as React from "react";
import { cn } from "@/lib/utils";

const field = "w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(field, "min-h-[96px] py-2 leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(field, "h-10 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
    </div>
  );
}
