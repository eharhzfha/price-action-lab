"use client";

import * as React from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Sidebar, BrandMark } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { ReplayBar } from "@/components/shell/ReplayBar";
import { AnalysisProvider, useReplayClock } from "@/hooks/useAnalysis";
import { BacktestProvider } from "@/hooks/useBacktest";
import { useAppStore, type AppSettings, type TabKey } from "@/store/useAppStore";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { ChartsPage } from "@/components/pages/ChartsPage";
import { EnginePage } from "@/components/pages/EnginePage";
import { BacktestPage } from "@/components/pages/BacktestPage";
import { PaperPage } from "@/components/pages/PaperPage";
import { RiskPage } from "@/components/pages/RiskPage";
import { JournalPage } from "@/components/pages/JournalPage";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const MOBILE_TABS: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "Command" },
  { key: "charts", label: "Charts" },
  { key: "engine", label: "Engine" },
  { key: "backtest", label: "Backtest" },
  { key: "paper", label: "Paper" },
  { key: "risk", label: "Risk" },
  { key: "journal", label: "Journal" },
];

function WorkspaceInner() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  useReplayClock();

  const pages: Record<TabKey, React.ReactNode> = {
    dashboard: <DashboardPage />,
    charts: <ChartsPage />,
    engine: <EnginePage />,
    backtest: <BacktestPage />,
    paper: <PaperPage />,
    risk: <RiskPage />,
    journal: <JournalPage />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-base-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="scrollbar-none flex gap-1 overflow-x-auto border-b border-white/[0.055] bg-base-950/60 px-4 py-2 md:hidden">
          {MOBILE_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                tab === item.key ? "bg-accent/15 text-accent" : "text-ink-500 hover:text-ink-200",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div key={tab} className="animate-fadeUp px-4 py-4 lg:px-6 lg:py-5">
            {pages[tab]}
          </div>
        </main>
        <ReplayBar />
      </div>
    </div>
  );
}

function LoadingScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base-950 px-6">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute left-1/2 top-1/3 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/[0.055] blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <div className="panel overflow-hidden rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                error ? "border-bear/30 bg-bear/10 text-bear" : "border-accent/25 bg-accent/10 text-accent",
              )}
            >
              {error ? <AlertTriangle className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-ink-100">
                {error ? "Could not load the market data" : "Warming up the desk"}
              </h1>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                {error
                  ? error
                  : "Parsing M1 NASDAQ futures, aggregating 4H / 1H structure, mapping liquidity and replaying the strategy engine."}
              </p>
            </div>
          </div>

          {!error && (
            <div className="mt-5 space-y-2">
              {["Local M1 dataset", "HTF structural bias", "Liquidity & POI map", "Replay cursor"].map((step, index) => (
                <div key={step} className="flex items-center gap-2.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-[8px] font-semibold text-accent">
                    {index + 1}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full animate-pulseSoft rounded-full bg-accent/40"
                      style={{ width: `${45 + index * 12}%`, animationDelay: `${index * 180}ms` }}
                    />
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.12em] text-ink-500">{step}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <Button onClick={onRetry} className="mt-5 w-full" variant="secondary">
              <RefreshCw className="h-3.5 w-3.5" /> Retry data load
            </Button>
          )}
        </div>
        <p className="mt-4 text-center text-[9px] uppercase tracking-[0.18em] text-ink-500">
          NQ · MNQ · New York session · all times ET
        </p>
      </div>
    </div>
  );
}

export function Workspace() {
  const loadDataset = useAppStore((s) => s.loadDataset);
  const setDataLoading = useAppStore((s) => s.setDataLoading);
  const setDataError = useAppStore((s) => s.setDataError);
  const setSettings = useAppStore((s) => s.setSettings);
  const dataLoading = useAppStore((s) => s.dataLoading);
  const dataError = useAppStore((s) => s.dataError);
  const candles = useAppStore((s) => s.candles);
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setDataLoading(true);
      setDataError(null);
      try {
        const [candlesResponse, settingsResponse] = await Promise.all([
          fetch("/api/candles", { signal: controller.signal, cache: "no-store" }),
          fetch("/api/settings", { signal: controller.signal, cache: "no-store" }).catch(() => null),
        ]);
        if (!candlesResponse.ok) {
          const payload = (await candlesResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Candle API returned ${candlesResponse.status}.`);
        }
        const payload = (await candlesResponse.json()) as {
          candles: Parameters<typeof loadDataset>[0];
          source: string;
          warnings?: string[];
        };
        if (cancelled) return;
        if (!payload.candles?.length) throw new Error("The dataset is empty.");
        loadDataset(payload.candles, "NQ1! · M1", payload.source, payload.warnings ?? []);

        if (settingsResponse?.ok) {
          const settingsPayload = (await settingsResponse.json()) as {
            settings?: Partial<AppSettings> & Record<string, unknown>;
          };
          const settings = settingsPayload.settings;
          if (settings && !cancelled) {
            setSettings({
              defaultInstrument: settings.defaultInstrument === "NQ" ? "NQ" : "MNQ",
              accountSize: Number(settings.accountSize ?? 100000),
              riskPct: Number(settings.riskPct ?? 1),
              commissionPerSide: Number(settings.commissionPerSide ?? 2.5),
              slippageTicks: Number(settings.slippageTicks ?? 1),
              observationStart: String(settings.observationStart ?? "09:50"),
              observationEnd: String(settings.observationEnd ?? "10:10"),
              defaultRR: Number(settings.defaultRR ?? 2),
              timezone: String(settings.timezone ?? "America/New_York"),
            });
          }
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setDataError(error instanceof Error ? error.message : "Unknown data error");
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [retry, loadDataset, setDataError, setDataLoading, setSettings]);

  if (dataLoading && !candles.length) {
    return <LoadingScreen error={null} onRetry={() => setRetry((value) => value + 1)} />;
  }

  if (dataError && !candles.length) {
    return <LoadingScreen error={dataError} onRetry={() => setRetry((value) => value + 1)} />;
  }

  return (
    <AnalysisProvider>
      <BacktestProvider>
        <WorkspaceInner />
      </BacktestProvider>
    </AnalysisProvider>
  );
}
