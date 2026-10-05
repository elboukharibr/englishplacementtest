import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", toneClass[tone], className)} {...props} />;
}

export function Progress({ value, className, tone = "primary", label }: { value: number; className?: string; tone?: "primary" | "success" | "warning" | "danger"; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const bar = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} aria-hidden />;
}

const alertIcon = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle };
export function Alert({ tone = "info", title, children, className, action }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children?: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const Icon = alertIcon[tone];
  const cls = { info: "border-primary/20 bg-primary-soft", success: "border-success/25 bg-success-soft", warning: "border-warning/30 bg-warning-soft", danger: "border-danger/30 bg-danger-soft" }[tone];
  const iconCls = { info: "text-primary", success: "text-success", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", cls, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconCls)} aria-hidden />
      <div className="flex-1 space-y-1">
        {title && <p className="font-medium text-fg">{title}</p>}
        {children && <div className="text-fg/80">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-4 rounded-full bg-primary-soft p-3 text-primary">
          <Icon className="size-6" />
        </div>
      )}
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-sm text-muted">{eyebrow}</div>}
        <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; tone?: Tone }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{label}</span>
        {Icon && (
          <span className={cn("rounded-lg p-1.5", toneClass[tone ?? "neutral"])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}
