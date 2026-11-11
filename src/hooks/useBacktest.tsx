"use client";

import * as React from "react";
import {
  runBacktest,
  DEFAULT_BACKTEST_CONFIG,
  type BacktestConfig,
  type BacktestResult,
} from "@/lib/engine/backtest";
import { useAppStore } from "@/store/useAppStore";

interface BacktestContextValue {
  result: BacktestResult | null;
  config: BacktestConfig;
  running: boolean;
  error: string | null;
  setConfig: (patch: Partial<BacktestConfig>) => void;
  run: (override?: Partial<BacktestConfig>) => void;
}

const BacktestContext = React.createContext<BacktestContextValue | null>(null);

export function BacktestProvider({ children }: { children: React.ReactNode }) {
  const candles = useAppStore((s) => s.candles);
  const settings = useAppStore((s) => s.settings);
  const [config, setConfigState] = React.useState<BacktestConfig>(() => ({
    ...DEFAULT_BACKTEST_CONFIG,
    instrument: "MNQ",
    startingBalance: 100000,
    riskPct: 1,
  }));
  const [result, setResult] = React.useState<BacktestResult | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const workerRef = React.useRef<Worker | null>(null);
  const autoStarted = React.useRef(false);
  const configRef = React.useRef(config);
  configRef.current = config;

  React.useEffect(() => {
    // Settings arrive asynchronously; align the default research config once.
    setConfigState((prev) => ({
      ...prev,
      instrument: settings.defaultInstrument,
      startingBalance: settings.accountSize,
      riskPct: settings.riskPct,
      commissionPerSide: settings.commissionPerSide,
      slippageTicks: settings.slippageTicks,
      observationStart: settings.observationStart,
      observationEnd: settings.observationEnd,
      rr: settings.defaultRR,
    }));
  }, [
    settings.defaultInstrument,
    settings.accountSize,
    settings.riskPct,
    settings.commissionPerSide,
    settings.slippageTicks,
    settings.observationStart,
    settings.observationEnd,
    settings.defaultRR,
  ]);

  const calculate = React.useCallback(
    (nextConfig: BacktestConfig) => {
      if (!candles.length) return;
      setRunning(true);
      setError(null);
      workerRef.current?.terminate();
      workerRef.current = null;

      try {
        const worker = new Worker(new URL("../workers/backtest.worker.ts", import.meta.url));
        workerRef.current = worker;
        worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: BacktestResult; error?: string }>) => {
          if (!event.data.ok || !event.data.result) {
            setError(event.data.error ?? "Backtest failed");
            setRunning(false);
            return;
          }
          setResult(event.data.result);
          setRunning(false);
          worker.terminate();
          workerRef.current = null;
        };
        worker.onerror = () => {
          // Worker unavailable (older browser / CSP) — run on the main thread.
          worker.terminate();
          workerRef.current = null;
          try {
            const fallback = runBacktest(candles, nextConfig);
            setResult(fallback);
          } catch (fallbackError) {
            setError(fallbackError instanceof Error ? fallbackError.message : "Backtest failed");
          }
          setRunning(false);
        };
        worker.postMessage({ candles, config: nextConfig });
      } catch {
        try {
          const fallback = runBacktest(candles, nextConfig);
          setResult(fallback);
        } catch (fallbackError) {
          setError(fallbackError instanceof Error ? fallbackError.message : "Backtest failed");
        }
        setRunning(false);
      }
    },
    [candles],
  );

  const run = React.useCallback(
    (override?: Partial<BacktestConfig>) => {
      const next = { ...configRef.current, ...(override ?? {}) };
      configRef.current = next;
      setConfigState(next);
      calculate(next);
    },
    [calculate],
  );

  React.useEffect(() => {
    if (!candles.length || autoStarted.current) return;
    autoStarted.current = true;
    const timer = window.setTimeout(() => calculate(configRef.current), 250);
    return () => window.clearTimeout(timer);
  }, [candles.length, calculate]);

  React.useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const setConfig = React.useCallback((patch: Partial<BacktestConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      configRef.current = next;
      return next;
    });
  }, []);

  const value = React.useMemo<BacktestContextValue>(
    () => ({ result, config, running, error, setConfig, run }),
    [result, config, running, error, setConfig, run],
  );

  return <BacktestContext.Provider value={value}>{children}</BacktestContext.Provider>;
}

export function useBacktest(): BacktestContextValue {
  const context = React.useContext(BacktestContext);
  if (!context) throw new Error("useBacktest must be used inside BacktestProvider");
  return context;
}
