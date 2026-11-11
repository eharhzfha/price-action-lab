"use client";

import { Check, CircleDashed, Clock3, Info, Minus, X } from "lucide-react";
import type { ChecklistItem } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

const ICONS = {
  PASS: Check,
  FAIL: X,
  WAIT: Clock3,
  INFO: Info,
} as const;

const TONE = {
  PASS: "border-bull/25 bg-bull/[0.055] text-bull",
  FAIL: "border-bear/25 bg-bear/[0.045] text-bear",
  WAIT: "border-warn/20 bg-warn/[0.035] text-warn",
  INFO: "border-white/[0.07] bg-white/[0.025] text-ink-400",
} as const;

export function ChecklistList({
  items,
  compact = false,
  className,
}: {
  items: ChecklistItem[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item) => {
        const Icon = ICONS[item.status];
        return (
          <div
            key={item.id}
            className={cn(
              "group flex items-start gap-2.5 rounded-md border px-2.5 transition",
              compact ? "py-1.5" : "py-2",
              TONE[item.status],
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                item.status === "PASS"
                  ? "border-bull/30 bg-bull/10"
                  : item.status === "FAIL"
                    ? "border-bear/30 bg-bear/10"
                    : item.status === "WAIT"
                      ? "border-warn/30 bg-warn/10"
                      : "border-white/10 bg-white/[0.04]",
              )}
            >
              <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium leading-tight text-ink-200">{item.label}</span>
                <span className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.12em] opacity-70">
                  {item.critical ? item.status : `${item.status} · info`}
                </span>
              </div>
              {!compact && (
                <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400/90">{item.detail}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StatusSummary({ items }: { items: ChecklistItem[] }) {
  const passed = items.filter((item) => item.status === "PASS").length;
  const failed = items.filter((item) => item.status === "FAIL").length;
  const critical = items.filter((item) => item.critical);
  const criticalPassed = critical.filter((item) => item.status === "PASS").length;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <CircleDashed className="h-3 w-3 text-ink-500" />
        <span className="text-[10px] text-ink-400">
          <span className="numeric font-semibold text-ink-200">{criticalPassed}</span> / {critical.length} critical gates
        </span>
      </div>
      <span className="h-3 w-px bg-white/10" />
      <span className="text-[10px] text-ink-400">
        <span className="numeric font-semibold text-bull">{passed}</span> pass
        {failed > 0 && (
          <>
            <span className="mx-1 text-ink-600">·</span>
            <span className="numeric font-semibold text-bear">{failed}</span> fail
          </>
        )}
      </span>
    </div>
  );
}

export function GateProgress({ items }: { items: ChecklistItem[] }) {
  const critical = items.filter((item) => item.critical);
  const passed = critical.filter((item) => item.status === "PASS").length;
  const pct = critical.length ? (passed / critical.length) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {critical.map((item, index) => (
          <span
            key={item.id}
            title={item.label}
            className={cn(
              "h-4 w-1 rounded-full transition-all",
              item.status === "PASS"
                ? "bg-bull"
                : item.status === "FAIL"
                  ? "bg-bear/70"
                  : item.status === "WAIT"
                    ? "bg-warn/60"
                    : "bg-white/10",
            )}
            style={{ opacity: 0.55 + index * 0.04 }}
          />
        ))}
      </div>
      <span className="numeric text-[10px] text-ink-400">{Math.round(pct)}%</span>
    </div>
  );
}

export function PendingGate({ items }: { items: ChecklistItem[] }) {
  const next = items.find((item) => item.critical && item.status !== "PASS");
  if (!next) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-warn/15 bg-warn/[0.035] px-2.5 py-1.5">
      <Minus className="h-3 w-3 shrink-0 text-warn" />
      <span className="text-[10px] text-ink-300">
        Next gate: <span className="font-medium text-warn">{next.label}</span>
      </span>
    </div>
  );
}
