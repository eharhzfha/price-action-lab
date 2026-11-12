"use client";

import { ArrowDownRight, ArrowUpRight, Crosshair, ExternalLink, ShieldCheck } from "lucide-react";
import { calculatePositionSize } from "@/lib/engine/risk";
import type { StrategyAnalysis } from "@/lib/engine/types";
import { useAppStore } from "@/store/useAppStore";
import { fmtMoney, fmtPoints, fmtPrice, fmtTime, cn } from "@/lib/utils";
import { Badge, Button, Progress } from "@/components/ui/primitives";
import { PendingGate } from "@/components/trading/Checklist";

export function SignalTicket({
  analysis,
  compact = false,
  hideActions = false,
}: {
  analysis: StrategyAnalysis | null;
  compact?: boolean;
  hideActions?: boolean;
}) {
  const settings = useAppStore((s) => s.settings);
  const setTab = useAppStore((s) => s.setTab);
  const setCursor = useAppStore((s) => s.setCursor);
  const signal = analysis?.setup.signal ?? null;

  if (!signal || !analysis) {
    const passed = analysis?.checklist.filter((item) => item.status === "PASS").length ?? 0;
    const total = analysis?.checklist.length ?? 0;
    return (
      <div className={cn("relative overflow-hidden rounded-lg border border-white/[0.07] bg-black/20 p-3 sm:p-4", compact ? "" : "min-h-[200px] sm:min-h-[230px]")}>
        <div className="flex items-center justify-between">
          <Badge variant="dark" dot>
            NO ACTIVE SIGNAL
          </Badge>
          <span className="text-[9px] uppercase tracking-[0.14em] text-ink-500">Stand aside</span>
        </div>
        <div className="mt-5 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warn/20 bg-warn/[0.06] text-warn">
            <Crosshair className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-ink-200">
              {analysis?.setup.state.replaceAll("_", " · ") ?? "Waiting for data"}
            </div>
            <p className="mt-1 max-w-md text-[11px] leading-relaxed text-ink-500">
              {analysis?.setup.reason ?? "The engine is loading market structure."}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-[10px] text-ink-500">
            <span>Checklist progress</span>
            <span className="numeric">{passed} / {total}</span>
          </div>
          <Progress value={total ? (passed / total) * 100 : 0} tone={passed > total * 0.6 ? "accent" : "warn"} />
        </div>
        {analysis && (
          <div className="mt-4">
            <PendingGate items={analysis.checklist} />
          </div>
        )}
      </div>
    );
  }

  const spec = calculatePositionSize({
    instrument: settings.defaultInstrument,
    accountSize: settings.accountSize,
    riskPct: settings.riskPct,
    entry: signal.entry,
    stop: signal.stop,
    target: signal.target,
  });

  const isLong = signal.direction === "LONG";
  const gradeTone = signal.grade === "A+" ? "pass" : signal.grade === "A" ? "bull" : signal.grade === "B" ? "info" : "wait";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-gradient-to-b from-white/[0.02] to-transparent",
        isLong ? "border-bull/25" : "border-bear/25",
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: isLong ? "linear-gradient(90deg,transparent,#2DD4A7,transparent)" : "linear-gradient(90deg,transparent,#F2557A,transparent)" }}
      />
      <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] p-3 sm:gap-3 sm:p-3.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              isLong ? "border-bull/30 bg-bull/10 text-bull" : "border-bear/30 bg-bear/10 text-bear",
            )}
          >
            {isLong ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[13px] font-semibold text-ink-100">{signal.direction} {settings.defaultInstrument}</span>
              <Badge variant={gradeTone}>{signal.grade}</Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-ink-500">
              <span className="whitespace-nowrap">Score {signal.score}</span>
              <span>·</span>
              <span className="whitespace-nowrap">Triggered {fmtTime(signal.triggerTime)} ET</span>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="micro-label">Planned R:R</div>
          <div className={cn("numeric whitespace-nowrap text-lg font-semibold", isLong ? "text-bull" : "text-bear")}>{signal.rr.toFixed(2)}R</div>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-b border-white/[0.06]">
        {[
          { label: "Entry", value: signal.entry, tone: "text-ink-100" },
          { label: "Stop", value: signal.stop, tone: "text-bear" },
          { label: "Target", value: signal.target, tone: "text-bull" },
        ].map((item) => (
          <div key={item.label} className="min-w-0 px-2 py-2.5 sm:px-3">
            <div className="micro-label">{item.label}</div>
            <div className={cn("numeric mt-1 whitespace-nowrap text-[13px] font-semibold sm:text-[15px]", item.tone)}>
              {fmtPrice(item.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:p-3.5">
        <MiniStat label="Stop distance" value={fmtPoints(signal.riskPoints)} />
        <MiniStat label="Contracts" value={`${spec.contracts} ${settings.defaultInstrument}`} tone={spec.contracts > 0 ? "text-ink-100" : "text-warn"} />
        <MiniStat label="Risk" value={fmtMoney(spec.riskActual)} tone="text-bear" />
        <MiniStat label="Target P&L" value={fmtMoney(spec.totalReward, { sign: true })} tone="text-bull" />
      </div>

      {!compact && (
        <div className="space-y-1.5 px-3 pb-3 sm:px-3.5 sm:pb-3.5">
          {signal.confluences.slice(0, 4).map((label) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-ink-400">
              <ShieldCheck className="h-3 w-3 shrink-0 text-bull/70" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {!hideActions && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.055] px-3 py-2.5 sm:px-3.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCursor(signal.triggerTime);
              setTab("charts");
            }}
          >
            <ExternalLink className="h-3 w-3" /> Open on chart
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setTab("paper")}>
            Send to paper desk
          </Button>
          <span className="ml-auto hidden text-[9px] text-ink-500 sm:inline">Model only · verify before execution</span>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone = "text-ink-200" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/[0.055] bg-black/20 px-2 py-2 sm:px-2.5">
      <div className="truncate text-[8px] uppercase tracking-[0.12em] text-ink-500">{label}</div>
      <div className={cn("numeric mt-1 whitespace-nowrap text-[12px] font-semibold", tone)}>{value}</div>
    </div>
  );
}
