"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-accent text-[#06111f] hover:bg-[#7bbcff] shadow-[0_0_20px_-8px_rgba(90,169,255,0.8)]",
        secondary: "border border-white/10 bg-white/[0.045] text-ink-200 hover:bg-white/[0.08] hover:border-white/15",
        outline: "border border-accent/35 bg-accent/[0.06] text-accent hover:bg-accent/[0.12]",
        ghost: "text-ink-300 hover:bg-white/[0.06] hover:text-ink-100",
        bull: "bg-bull text-[#04140f] hover:bg-[#4fe3bb]",
        bear: "bg-bear text-[#1a0509] hover:bg-[#ff6d8d]",
        danger: "border border-bear/30 bg-bear/10 text-bear hover:bg-bear/20",
        subtle: "bg-base-700/60 text-ink-300 hover:bg-base-600 hover:text-ink-100",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-2.5 text-xs",
        xs: "h-6 px-2 text-[11px]",
        lg: "h-10 px-5 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export function Panel({
  title,
  subtitle,
  action,
  icon,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}) {
  return (
    <section className={cn("panel relative overflow-hidden rounded-lg", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.055] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="text-ink-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
            <div className="min-w-0">
              <h2 className="truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-200">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 truncate text-[11px] text-ink-500">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(flush ? "" : "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] leading-none",
  {
    variants: {
      variant: {
        neutral: "border-white/10 bg-white/[0.04] text-ink-300",
        pass: "border-bull/35 bg-bull/[0.09] text-bull",
        fail: "border-bear/35 bg-bear/[0.09] text-bear",
        wait: "border-warn/35 bg-warn/[0.09] text-warn",
        info: "border-accent/30 bg-accent/[0.08] text-accent",
        bull: "border-bull/30 bg-bull/[0.08] text-bull",
        bear: "border-bear/30 bg-bear/[0.08] text-bear",
        violet: "border-violet/30 bg-violet/[0.08] text-violet",
        dark: "border-white/[0.06] bg-black/30 text-ink-400",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  dot,
  children,
}: {
  className?: string;
  variant?: VariantProps<typeof badgeVariants>["variant"];
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {dot && <span className="h-1 w-1 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StatusDot({ tone = "neutral", pulse }: { tone?: "bull" | "bear" | "warn" | "accent" | "neutral"; pulse?: boolean }) {
  const colors = {
    bull: "bg-bull",
    bear: "bg-bear",
    warn: "bg-warn",
    accent: "bg-accent",
    neutral: "bg-ink-500",
  };
  return (
    <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", colors[tone], pulse && "animate-pulseSoft")} />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-white/[0.08] bg-black/25 px-3 text-[13px] text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-accent/50 focus:bg-black/35 focus:ring-1 focus:ring-accent/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[84px] w-full resize-y rounded-md border border-white/[0.08] bg-black/25 px-3 py-2 text-[13px] leading-relaxed text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-white/[0.08] bg-black/25 px-3 pr-8 text-[13px] text-ink-100 outline-none transition focus:border-accent/50 focus:ring-1 focus:ring-accent/20",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%237f8b97%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-no-repeat",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
  right,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center justify-between">
        <span className="micro-label">{label}</span>
        {right}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] leading-snug text-ink-500">{hint}</span>}
    </label>
  );
}

export function Metric({
  label,
  value,
  sub,
  tone,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "bull" | "bear" | "accent" | "warn" | "default";
  icon?: React.ReactNode;
  className?: string;
}) {
  const toneClass = {
    bull: "text-bull",
    bear: "text-bear",
    accent: "text-accent",
    warn: "text-warn",
    default: "text-ink-100",
  }[tone ?? "default"];
  return (
    <div className={cn("panel relative rounded-lg px-4 py-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="micro-label">{label}</span>
        {icon && <span className="text-ink-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      </div>
      <div className={cn("numeric mt-2 text-[22px] font-semibold leading-none tracking-tight", toneClass)}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] leading-tight text-ink-400">{sub}</div>}
    </div>
  );
}

export function Progress({ value, tone = "accent", className }: { value: number; tone?: "bull" | "bear" | "accent" | "warn"; className?: string }) {
  const colors = { bull: "bg-bull", bear: "bg-bear", accent: "bg-accent", warn: "bg-warn" };
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "default",
  className,
}: {
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md border border-white/[0.07] bg-black/25 p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded px-2.5 font-medium transition",
            size === "sm" ? "h-6 text-[10px]" : "h-7 text-[11px]",
            value === option.value
              ? "bg-white/[0.09] text-ink-100 shadow-sm"
              : "text-ink-500 hover:text-ink-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center gap-2 text-[11px] text-ink-400", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-4 w-7 rounded-full border transition-colors",
          checked ? "border-accent/40 bg-accent/30" : "border-white/10 bg-white/[0.06]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all",
            checked ? "left-3.5 bg-accent" : "left-0.5 bg-ink-500",
          )}
        />
      </button>
      {label}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-ink-500 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-ink-200">{title}</h3>
      <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-ink-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-fadeUp" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[94vw] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/10 bg-base-850 shadow-2xl outline-none data-[state=open]:animate-fadeUp",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-sm font-semibold text-ink-100">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-[11px] leading-relaxed text-ink-500">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded p-1 text-ink-500 transition hover:bg-white/5 hover:text-ink-200">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3.5">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function TableShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-[12px]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-white/[0.035] px-3 py-2.5 text-ink-300", className)}>{children}</td>;
}
