"use client";

import * as React from "react";
import { analyzeStrategy } from "@/lib/engine/strategy";
import { useAppStore } from "@/store/useAppStore";
import type { EngineConfig, StrategyAnalysis } from "@/lib/engine/types";

interface AnalysisContextValue {
  analysis: StrategyAnalysis | null;
  config: EngineConfig;
  asOf: number;
}

const AnalysisContext = React.createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const candles = useAppStore((s) => s.candles);
  const cursor = useAppStore((s) => s.cursor);
  const config = useAppStore((s) => s.engineConfig);

  const value = React.useMemo<AnalysisContextValue>(() => {
    if (!candles.length || !cursor) return { analysis: null, config, asOf: cursor };
    let analysis: StrategyAnalysis | null = null;
    try {
      analysis = analyzeStrategy(candles, config, cursor);
    } catch (error) {
      console.error("Strategy evaluation failed", error);
    }
    return { analysis, config, asOf: cursor };
  }, [candles, cursor, config]);

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const context = React.useContext(AnalysisContext);
  if (!context) throw new Error("useAnalysis must be used inside AnalysisProvider");
  return context;
}

/** Drives playback globally so a running replay survives tab changes. */
export function useReplayClock() {
  const playing = useAppStore((s) => s.playing);
  const speedMs = useAppStore((s) => s.speedMs);

  React.useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      useAppStore.getState().tick();
    }, speedMs);
    return () => window.clearInterval(interval);
  }, [playing, speedMs]);
}
