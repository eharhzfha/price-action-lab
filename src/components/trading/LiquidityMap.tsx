"use client";

import { ArrowDown, ArrowUp, CircleDot, Layers } from "lucide-react";
import type { StrategyAnalysis } from "@/lib/engine/types";
import { fmtPoints, fmtPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";

export function LiquidityMap({ analysis, compact = false }: { analysis: StrategyAnalysis | null; compact?: boolean }) {
  if (!analysis) return <div className="p-4 text-[11px] text-ink-500">Waiting for liquidity map…</div>;
  const levels = analysis.liquidity.levels;
  const activeSweep = analysis.liquidity.activeSweep;
  const sweptKeys = new Set(analysis.liquidity.sweeps.map((sweep) => `${sweep.level.key}_${sweep.side}`));

  if (!levels.length) {
    return <div className="p-4 text-[11px] text-ink-500">No confirmed liquidity levels in the lookback window.</div>;
  }

  return (
    <div className="divide-y divide-white/[0.035]">
      {levels.slice(0, compact ? 5 : 10).map((level) => {
        const isBuySide = level.side === "BUY_SIDE";
        const swept = sweptKeys.has(`${level.key}_${level.side}`);
        const active = activeSweep?.level.key === level.key && activeSweep.side === level.side;
        return (
          <div key={level.key} className="flex items-center gap-3 px-3.5 py-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                isBuySide ? "border-bear/20 bg-bear/[0.06] text-bear" : "border-bull/20 bg-bull/[0.06] text-bull"
              }`}
            >
              {isBuySide ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11px] font-medium text-ink-300">{level.label}</span>
                {active && <Badge variant="wait">ACTIVE</Badge>}
                {swept && !active && <Badge variant="neutral">SWEPT</Badge>}
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-ink-500">
                {isBuySide ? "Buy-side liquidity" : "Sell-side liquidity"}
              </div>
            </div>
            <div className="text-right">
              <div className="numeric text-[11px] font-medium text-ink-200">{fmtPrice(level.price)}</div>
              <div className={`numeric text-[9px] ${level.distance >= 0 ? "text-bull/80" : "text-bear/80"}`}>
                {fmtPoints(level.distance, true)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LiquiditySummary({ analysis }: { analysis: StrategyAnalysis | null }) {
  if (!analysis) return null;
  const active = analysis.liquidity.activeSweep;
  const nearest = analysis.liquidity.levels[0];
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.12em] text-ink-500">
          <Layers className="h-2.5 w-2.5" /> Liquidity
        </div>
        <div className="mt-1 truncate text-[11px] font-medium text-ink-200">
          {active ? active.level.label : "Awaiting sweep"}
        </div>
        <div className="numeric mt-0.5 text-[9px] text-ink-500">
          {active ? `${fmtPoints(active.penetration)} penetration` : `${analysis.liquidity.levels.length} levels mapped`}
        </div>
      </div>
      <div className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.12em] text-ink-500">
          <CircleDot className="h-2.5 w-2.5" /> Nearest pool
        </div>
        <div className="mt-1 truncate text-[11px] font-medium text-ink-200">{nearest?.label ?? "—"}</div>
        <div className="numeric mt-0.5 text-[9px] text-ink-500">
          {nearest ? `${fmtPrice(nearest.price)} · ${fmtPoints(nearest.distance, true)}` : "—"}
        </div>
      </div>
    </div>
  );
}
