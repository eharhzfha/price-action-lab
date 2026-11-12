"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  FileUp,
  FlaskConical,
  RefreshCw,
  Save,
  ShieldCheck,
  Timer,
  UploadCloud,
  Zap,
} from "lucide-react";
import { useBacktest } from "@/hooks/useBacktest";
import { useAppStore } from "@/store/useAppStore";
import { parseCsv } from "@/lib/engine/csv";
import { tradingDayKey } from "@/lib/engine/time";
import type { BacktestTrade } from "@/lib/engine/backtest";
import type { Candle } from "@/lib/engine/types";
import { downloadTextFile, fmtDateTime, fmtMoney, fmtPct, fmtPrice, fmtR, fmtTime, cn } from "@/lib/utils";
import { Badge, Button, EmptyState, Field, Input, Metric, Panel, Progress, Select, TableShell, Td, Th } from "@/components/ui/primitives";
import { EquityCurve } from "@/components/trading/Charts";

interface SavedRun {
  id: string;
  name: string;
  datasetName: string;
  createdAt: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  netPnl: number;
  expectancyR: number;
  maxDrawdown: number;
}

export function BacktestPage() {
  const { result, config, running, error, setConfig, run } = useBacktest();
  const candles = useAppStore((s) => s.candles);
  const loadDataset = useAppStore((s) => s.loadDataset);
  const setDay = useAppStore((s) => s.setDay);
  const setCursor = useAppStore((s) => s.setCursor);
  const setTab = useAppStore((s) => s.setTab);
  const datasetName = useAppStore((s) => s.datasetName);
  const settings = useAppStore((s) => s.settings);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [name, setName] = React.useState("MNQ · structural replay");
  const [notes, setNotes] = React.useState("");
  const [uploadMessage, setUploadMessage] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = React.useState<Candle[] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [savedRuns, setSavedRuns] = React.useState<SavedRun[]>([]);

  const loadSavedRuns = React.useCallback(async () => {
    try {
      const response = await fetch("/api/backtests?limit=12", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { runs?: SavedRun[] };
      setSavedRuns(payload.runs ?? []);
    } catch {
      // Research results still work when persistence is unavailable.
    }
  }, []);

  React.useEffect(() => {
    void loadSavedRuns();
  }, [loadSavedRuns]);

  React.useEffect(() => {
    if (!pendingUpload || !candles.length) return;
    if (candles === pendingUpload) {
      setPendingUpload(null);
      run();
    }
  }, [candles, pendingUpload, run]);

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploadMessage(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.candles.length) {
        setUploadError(parsed.errors.join(" ") || "No candles found in the file.");
        return;
      }
      setPendingUpload(parsed.candles);
      loadDataset(parsed.candles, file.name, `uploaded:${file.name}`, parsed.warnings);
      setUploadMessage(
        `Loaded ${parsed.candles.length.toLocaleString()} candles from ${file.name} (${parsed.rows.toLocaleString()} rows, ${parsed.skipped} skipped). ${parsed.warnings[0] ?? ""}`,
      );
      setName(`${file.name.replace(/\.csv$/i, "")} · replay`);
    } catch (fileError) {
      setUploadError(fileError instanceof Error ? fileError.message : "Could not read the file.");
    }
  };

  const restoreSample = async () => {
    setUploadError(null);
    setUploadMessage(null);
    try {
      const response = await fetch("/api/candles", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not reload the built-in dataset.");
      const payload = (await response.json()) as { candles: Candle[]; source: string; warnings?: string[] };
      setPendingUpload(payload.candles);
      loadDataset(payload.candles, "NQ1! · M1", payload.source, payload.warnings ?? []);
      setUploadMessage("Restored the built-in sample dataset.");
    } catch (restoreError) {
      setUploadError(restoreError instanceof Error ? restoreError.message : "Could not restore sample data.");
    }
  };

  const saveRun = async () => {
    if (!result) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/backtests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Untitled replay",
          datasetName,
          config: result.config,
          metrics: result.metrics,
          trades: result.trades,
          equity: result.equityCurve,
          totalTrades: result.metrics.totalTrades,
          winRate: result.metrics.winRate,
          profitFactor: result.metrics.profitFactor,
          expectancyR: result.metrics.expectancyR,
          maxDrawdown: result.metrics.maxDrawdown,
          netPnl: result.metrics.netPnl,
          notes: notes.trim() || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Save failed.");
      setSaveMessage("Backtest saved to local SQLite.");
      await loadSavedRuns();
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const replayTrade = (trade: BacktestTrade) => {
    setDay(tradingDayKey(trade.entryTime));
    setCursor(trade.entryTime);
    setTab("charts");
  };

  const exportTrades = () => {
    if (!result) return;
    const header = "entry_time,exit_time,direction,entry,exit,quantity,pnl,r_multiple,exit_reason,grade";
    const rows = result.trades.map((trade) =>
      [
        fmtDateTime(trade.entryTime),
        fmtDateTime(trade.exitTime),
        trade.direction,
        trade.entryPrice,
        trade.exitPrice,
        trade.quantity,
        trade.pnl,
        trade.rMultiple,
        trade.exitReason,
        trade.grade ?? "",
      ].join(","),
    );
    downloadTextFile("price-action-lab-backtest.csv", [header, ...rows].join("\n"));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Metric
          label="Net P&L"
          value={result ? fmtMoney(result.metrics.netPnl, { sign: true }) : "—"}
          tone={result && result.metrics.netPnl >= 0 ? "bull" : "bear"}
          icon={<BarChart3 />}
          sub={result ? `${fmtPct(result.metrics.returnPct, 2, true)} on ${fmtMoney(result.startingBalance, { compact: true })}` : "Run a backtest to populate"}
        />
        <Metric
          label="Win rate"
          value={result ? fmtPct(result.metrics.winRate) : "—"}
          tone="accent"
          icon={<Zap />}
          sub={result ? `${result.metrics.wins}W / ${result.metrics.losses}L · ${result.metrics.totalTrades} trades` : "No trades evaluated"}
        />
        <Metric
          label="Profit factor"
          value={result ? (result.metrics.profitFactorInfinite ? "∞" : result.metrics.profitFactor.toFixed(2)) : "—"}
          tone={result && result.metrics.profitFactor >= 1.5 ? "bull" : "default"}
          icon={<ShieldCheck />}
          sub={result ? `${fmtMoney(result.metrics.grossProfit)} gross profit / ${fmtMoney(result.metrics.grossLoss)} gross loss` : "Selectivity + R:R"}
        />
        <Metric
          label="Max drawdown"
          value={result ? fmtMoney(result.metrics.maxDrawdown) : "—"}
          tone="warn"
          icon={<ArrowDownRight />}
          sub={result ? `${fmtPct(result.metrics.maxDrawdownPct, 2)} peak-to-trough · ${fmtMoney(result.metrics.totalFees)} fees` : "Chronological, one trade/day"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
        <Panel
          title="Equity curve"
          subtitle={result ? `${result.days} sessions · ${result.daysEvaluated} evaluated · ${result.evaluations.toLocaleString()} strategy evaluations` : "Awaiting research run"}
          icon={<FlaskConical />}
          action={
            <div className="flex items-center gap-2">
              {running && <Badge variant="info" dot>RUNNING</Badge>}
              {result && <Badge variant="dark">{result.durationMs.toLocaleString()} ms</Badge>}
              <Button variant="ghost" size="xs" onClick={exportTrades} disabled={!result}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>
          }
        >
          {error ? (
            <div className="rounded-md border border-bear/20 bg-bear/[0.04] p-3 text-[11px] text-bear">{error}</div>
          ) : running && !result ? (
            <div className="flex h-[230px] flex-col items-center justify-center gap-3 text-[11px] text-ink-500">
              <Timer className="h-6 w-6 animate-pulse text-accent" />
              Replaying every session bar-by-bar…
            </div>
          ) : result ? (
            <>
              <EquityCurve points={result.equityCurve} startingBalance={result.startingBalance} height={245} />
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                <ResultStat label="Expectancy" value={fmtR(result.metrics.expectancyR)} />
                <ResultStat label="Avg win" value={fmtMoney(result.metrics.avgWin)} />
                <ResultStat label="Avg loss" value={fmtMoney(result.metrics.avgLoss)} />
                <ResultStat label="Best" value={fmtMoney(result.metrics.bestTrade, { sign: true })} />
                <ResultStat label="Worst" value={fmtMoney(result.metrics.worstTrade, { sign: true })} />
                <ResultStat label="Sharpe (R)" value={result.metrics.sharpeR.toFixed(2)} />
              </div>
            </>
          ) : (
            <EmptyState icon={<FlaskConical />} title="No backtest result" description="Use the configuration panel and run the chronological replay." />
          )}
        </Panel>

        <Panel
          title="Research configuration"
          subtitle="Deterministic · stops resolved before targets"
          icon={<ShieldCheck />}
          action={<Button variant="ghost" size="xs" onClick={() => run()} disabled={running}>{running ? "Running" : "Run"}</Button>}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Instrument">
              <Select value={config.instrument} onChange={(event) => setConfig({ instrument: event.target.value as "NQ" | "MNQ" })}>
                <option value="MNQ">MNQ · $2/pt</option>
                <option value="NQ">NQ · $20/pt</option>
              </Select>
            </Field>
            <Field label="Starting balance">
              <Input type="number" min={1000} step={1000} value={config.startingBalance} onChange={(event) => setConfig({ startingBalance: Number(event.target.value) })} />
            </Field>
            <Field label="Risk / trade (%)">
              <Input type="number" min={0.1} max={10} step={0.1} value={config.riskPct} onChange={(event) => setConfig({ riskPct: Number(event.target.value) })} />
            </Field>
            <Field label="Target R">
              <Input type="number" min={0.5} max={10} step={0.25} value={config.rr} onChange={(event) => setConfig({ rr: Number(event.target.value) })} />
            </Field>
            <Field label="Commission / side">
              <Input type="number" min={0} step={0.25} value={config.commissionPerSide} onChange={(event) => setConfig({ commissionPerSide: Number(event.target.value) })} />
            </Field>
            <Field label="Slippage (ticks)">
              <Input type="number" min={0} max={20} step={0.25} value={config.slippageTicks} onChange={(event) => setConfig({ slippageTicks: Number(event.target.value) })} />
            </Field>
            <Field label="Max trades / day">
              <Input type="number" min={1} max={5} value={config.maxTradesPerDay} onChange={(event) => setConfig({ maxTradesPerDay: Number(event.target.value) })} />
            </Field>
            <Field label="Max hold (min)">
              <Input type="number" min={15} max={390} step={5} value={config.maxHoldMinutes} onChange={(event) => setConfig({ maxHoldMinutes: Number(event.target.value) })} />
            </Field>
            <Field label="Window start">
              <Input type="time" value={config.observationStart} onChange={(event) => setConfig({ observationStart: event.target.value })} />
            </Field>
            <Field label="Window end">
              <Input type="time" value={config.observationEnd} onChange={(event) => setConfig({ observationEnd: event.target.value })} />
            </Field>
            <Field label="Exit time">
              <Input type="time" value={config.exitTime} onChange={(event) => setConfig({ exitTime: event.target.value })} />
            </Field>
            <Field label="Warm-up days">
              <Input type="number" min={0} max={10} value={config.warmupDays} onChange={(event) => setConfig({ warmupDays: Number(event.target.value) })} />
            </Field>
          </div>
          <Button className="mt-3 w-full" onClick={() => run()} disabled={running || !candles.length}>
            {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            {running ? "Replaying market…" : "Run chronological backtest"}
          </Button>
          <p className="mt-2 text-[9px] leading-relaxed text-ink-500">
            Strategy receives candles [0..i] only. Entries fill at the next bar open with slippage. If stop and target occur in the same minute, the stop is assumed first.
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
        <Panel
          title="Trade ledger"
          subtitle={result ? `${result.trades.length} closed trades · ${fmtMoney(result.finalBalance)} final balance` : "No result"}
          icon={<BarChart3 />}
          flush
          action={result && <Badge variant="dark">{result.config.instrument}</Badge>}
        >
          {result?.trades.length ? (
            <div className="max-h-[420px] overflow-auto">
              <TableShell>
                <thead className="sticky top-0 z-10 bg-base-850">
                  <tr>
                    <Th>#</Th>
                    <Th>Entry</Th>
                    <Th>Dir</Th>
                    <Th>Entry / exit</Th>
                    <Th>Qty</Th>
                    <Th>R</Th>
                    <Th>P&L</Th>
                    <Th>Exit</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((trade, index) => (
                    <tr key={trade.id} className="group hover:bg-white/[0.02]">
                      <Td className="text-ink-500">{index + 1}</Td>
                      <Td>
                        <div className="text-[10px] text-ink-300">{fmtDateTime(trade.entryTime)}</div>
                        <div className="text-[9px] text-ink-500">{fmtTime(trade.exitTime)} exit</div>
                      </Td>
                      <Td>
                        <span className={cn("flex items-center gap-1 text-[10px] font-medium", trade.direction === "LONG" ? "text-bull" : "text-bear")}>
                          {trade.direction === "LONG" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {trade.direction}
                        </span>
                      </Td>
                      <Td className="numeric text-[10px]">{fmtPrice(trade.entryPrice)} → {fmtPrice(trade.exitPrice)}</Td>
                      <Td className="numeric text-[10px]">{trade.quantity}</Td>
                      <Td className={cn("numeric text-[10px] font-medium", trade.rMultiple >= 0 ? "text-bull" : "text-bear")}>{fmtR(trade.rMultiple)}</Td>
                      <Td className={cn("numeric text-[10px] font-medium", trade.pnl >= 0 ? "text-bull" : "text-bear")}>{fmtMoney(trade.pnl, { sign: true })}</Td>
                      <Td><Badge variant={trade.exitReason === "TARGET" ? "pass" : trade.exitReason === "STOP" ? "fail" : "dark"}>{trade.exitReason}</Badge></Td>
                      <Td>
                        <Button variant="ghost" size="xs" onClick={() => replayTrade(trade)}>Replay</Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
          ) : (
            <EmptyState icon={<FlaskConical />} title="No trades" description="The engine found no qualifying setups in this dataset and configuration." />
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Save research run" subtitle="Persist config, trades and equity to SQLite" icon={<Save />}>
            <Field label="Run name">
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} />
            </Field>
            <Field label="Notes" className="mt-2.5">
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Hypothesis, regime, change made…" maxLength={4000} />
            </Field>
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={saveRun} disabled={!result || saving}>
              <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save backtest"}
            </Button>
            {saveMessage && (
              <p className={cn("mt-2 text-[10px]", saveMessage.toLowerCase().includes("saved") ? "text-bull" : "text-bear")}>{saveMessage}</p>
            )}
            {savedRuns.length > 0 && (
              <div className="mt-3 divide-y divide-white/[0.035]">
                {savedRuns.slice(0, 4).map((savedRun) => (
                  <div key={savedRun.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-[10px] text-ink-300">{savedRun.name}</div>
                      <div className="text-[8px] text-ink-500">{new Date(savedRun.createdAt).toLocaleDateString()} · {savedRun.totalTrades} trades</div>
                    </div>
                    <span className={cn("numeric shrink-0 text-[10px]", savedRun.netPnl >= 0 ? "text-bull" : "text-bear")}>{fmtMoney(savedRun.netPnl, { sign: true })}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Dataset & integrity" subtitle="Import a broker / TradingView M1 export" icon={<UploadCloud />}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-md border border-dashed border-white/[0.11] bg-black/20 px-4 py-5 text-center transition hover:border-accent/35 hover:bg-accent/[0.025]"
            >
              <FileUp className="h-5 w-5 text-ink-500" />
              <span className="mt-2 text-[11px] font-medium text-ink-300">Drop in a CSV or click to browse</span>
              <span className="mt-0.5 text-[9px] text-ink-500">timestamp, open, high, low, close, volume</span>
            </button>
            {uploadError && <p className="mt-2 text-[10px] text-bear">{uploadError}</p>}
            {uploadMessage && <p className="mt-2 text-[10px] leading-relaxed text-bull/90">{uploadMessage}</p>}
            <div className="mt-3 flex items-center justify-between rounded-md border border-white/[0.05] px-2.5 py-2">
              <div>
                <div className="text-[9px] uppercase tracking-[0.1em] text-ink-500">Active dataset</div>
                <div className="mt-0.5 max-w-[210px] truncate text-[10px] text-ink-300">{datasetName} · {candles.length.toLocaleString()} bars</div>
              </div>
              <Button variant="ghost" size="xs" onClick={restoreSample}>Restore sample</Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <IntegrityStat label="Days" value={result?.days.toLocaleString() ?? "—"} />
              <IntegrityStat label="Warm-up bars" value={result?.warmupSkipped.toLocaleString() ?? "—"} />
              <IntegrityStat label="Evaluations" value={result?.evaluations.toLocaleString() ?? "—"} />
              <IntegrityStat label="Runtime" value={result ? `${(result.durationMs / 1000).toFixed(1)}s` : "—"} />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-bull/15 bg-bull/[0.035] px-2.5 py-2 text-[9px] text-bull/80">
              <ShieldCheck className="h-3 w-3 shrink-0" /> Zero look-ahead enforced at the engine layer
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/[0.05] bg-black/20 px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div className="numeric mt-0.5 text-[10px] font-medium text-ink-200">{value}</div>
    </div>
  );
}

function IntegrityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/[0.05] bg-black/20 px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div className="numeric mt-0.5 text-[11px] font-medium text-ink-200">{value}</div>
    </div>
  );
}
