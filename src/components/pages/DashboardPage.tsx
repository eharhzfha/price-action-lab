"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Gauge,
  Layers,
  Radar,
  ScanLine,
  ShieldCheck,
  Target,
  Timer,
  Zap,
} from "lucide-react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useBacktest } from "@/hooks/useBacktest";
import { useAppStore } from "@/store/useAppStore";
import { sessionMomentum } from "@/lib/engine/liquidity";
import { windowProgress } from "@/lib/engine/strategy";
import { tradingDayKey } from "@/lib/engine/time";
import type { Direction } from "@/lib/engine/types";
import { fmtDate, fmtDateTime, fmtMoney, fmtPct, fmtPoints, fmtPrice, fmtTime, cn } from "@/lib/utils";
import { Badge, Button, Metric, Panel, Progress, StatusDot, TableShell, Td, Th } from "@/components/ui/primitives";
import { ChecklistList, GateProgress, StatusSummary } from "@/components/trading/Checklist";
import { SignalTicket } from "@/components/trading/SignalTicket";
import { LiquidityMap } from "@/components/trading/LiquidityMap";
import { EquityCurve } from "@/components/trading/Charts";

function biasTone(direction: Direction) {
  return direction === "BULLISH" ? "text-bull" : direction === "BEARISH" ? "text-bear" : "text-warn";
}

function DirectionIcon({ direction, className }: { direction: Direction; className?: string }) {
  if (direction === "BULLISH") return <ArrowUpRight className={className} />;
  if (direction === "BEARISH") return <ArrowDownRight className={className} />;
  return <Activity className={className} />;
}

export function DashboardPage() {
  const { analysis } = useAnalysis();
  const { result, running, error } = useBacktest();
  const candles = useAppStore((s) => s.candles);
  const cursor = useAppStore((s) => s.cursor);
  const dayKey = useAppStore((s) => s.dayKey);
  const config = useAppStore((s) => s.engineConfig);
  const settings = useAppStore((s) => s.settings);
  const setTab = useAppStore((s) => s.setTab);
  const setDay = useAppStore((s) => s.setDay);
  const setCursor = useAppStore((s) => s.setCursor);

  const momentum = analysis ? sessionMomentum(candles, analysis.asOf) : null;
  const winPct = windowProgress(cursor, config);
  const signal = analysis?.setup.signal ?? null;
  const evidence = analysis?.checklist ?? [];
  const passedCritical = evidence.filter((item) => item.critical && item.status === "PASS").length;
  const criticalCount = evidence.filter((item) => item.critical).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Metric
          label="NQ last price"
          value={fmtPrice(analysis?.price)}
          tone="default"
          icon={<BarChart3 />}
          sub={
            momentum ? (
              <span className={momentum.sessionChangePct >= 0 ? "text-bull" : "text-bear"}>
                {fmtPct(momentum.sessionChangePct, 2, true)} NY session · H {fmtPrice(momentum.sessionHigh)} / L {fmtPrice(momentum.sessionLow)}
              </span>
            ) : (
              "Loading session context"
            )
          }
        />
        <Metric
          label="4H / 1H bias"
          value={
            <span className="flex items-center gap-2 text-[17px]">
              <span className={biasTone(analysis?.htf.bias4h.direction ?? "NEUTRAL")}>
                4H {analysis?.htf.bias4h.direction.slice(0, 4) ?? "—"}
              </span>
              <span className="text-ink-600">/</span>
              <span className={biasTone(analysis?.htf.bias1h.direction ?? "NEUTRAL")}>
                1H {analysis?.htf.bias1h.direction.slice(0, 4) ?? "—"}
              </span>
            </span>
          }
          tone={analysis?.htf.aligned ? "bull" : analysis?.htf.conflicted ? "warn" : "default"}
          icon={<Gauge />}
          sub={analysis?.htf.contextLabel ?? "Resolving higher timeframe structure"}
        />
        <Metric
          label="Setup state"
          value={<span className="text-[17px]">{analysis?.setup.state.replaceAll("_", " ") ?? "—"}</span>}
          tone={analysis?.setup.state === "TRIGGERED" ? "bull" : analysis?.setup.state === "CONTEXT_UNCLEAR" ? "warn" : "default"}
          icon={<Radar />}
          sub={
            <span className="flex items-center gap-1.5">
              <StatusDot tone={analysis?.setup.state === "TRIGGERED" ? "bull" : "warn"} pulse={!!signal} />
              {analysis?.setup.grade ? `${analysis.setup.grade} grade · score ${signal?.score}` : "No valid trigger at cursor"}
            </span>
          }
        />
        <Metric
          label="Observation window"
          value={<span className="text-[17px]">{analysis?.windowLabel ?? "09:50–10:10 ET"}</span>}
          tone={analysis?.inWindow ? "accent" : "default"}
          icon={<Clock3 />}
          sub={
            <span className="flex items-center gap-2">
              <Progress value={winPct * 100} tone={analysis?.inWindow ? "accent" : "warn"} className="w-20" />
              {analysis?.inWindow ? "OPEN" : cursor < (analysis?.asOf ?? 0) ? "ELAPSED" : "PENDING"}
            </span>
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
        <Panel
          title="Session brief"
          subtitle={`${analysis?.tradingDay ? fmtDate(analysis.asOf) : dayKey} · all times America/New_York`}
          icon={<ScanLine />}
          action={
            <div className="flex items-center gap-2">
              <Badge variant={analysis?.htf.aligned ? "pass" : analysis?.htf.conflicted ? "wait" : "dark"}>
                {analysis?.htf.aligned ? "ALIGNED" : analysis?.htf.conflicted ? "CONFLICT" : "UNCLEAR"}
              </Badge>
              <Button variant="ghost" size="xs" onClick={() => setTab("charts")}>
                Open chart
              </Button>
            </div>
          }
        >
          <div className="relative overflow-hidden rounded-md border border-white/[0.055] bg-black/20 p-4">
            <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent/[0.05] blur-2xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-ink-500">
                  <StatusDot tone="bull" pulse /> Local replay cursor
                </div>
                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="numeric text-[32px] font-semibold leading-none tracking-tight text-ink-100">{fmtPrice(analysis?.price)}</span>
                  <span className="text-[11px] text-ink-500">NQ1!</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-ink-500">
                  <span>{fmtDateTime(cursor)}</span>
                  <span className="text-ink-600">·</span>
                  <span>{analysis?.meta.barsUsed.toLocaleString() ?? "—"} M1 bars evaluated</span>
                  <span className="text-ink-600">·</span>
                  <span className="text-bull">zero look-ahead</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right">
                <div>
                  <div className="micro-label">Session high</div>
                  <div className="numeric mt-1 text-[11px] text-ink-200">{fmtPrice(momentum?.sessionHigh)}</div>
                </div>
                <div>
                  <div className="micro-label">Session low</div>
                  <div className="numeric mt-1 text-[11px] text-ink-200">{fmtPrice(momentum?.sessionLow)}</div>
                </div>
                <div>
                  <div className="micro-label">ORB range</div>
                  <div className="numeric mt-1 text-[11px] text-ink-200">{fmtPoints(momentum?.openingRange ?? 0)}</div>
                </div>
              </div>
            </div>

            <div className="relative mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "4H structure", value: analysis?.htf.bias4h.direction ?? "—", detail: lastEventLabel(analysis?.htf.bias4h.structure.lastEvent) },
                { label: "1H structure", value: analysis?.htf.bias1h.direction ?? "—", detail: lastEventLabel(analysis?.htf.bias1h.structure.lastEvent) },
                {
                  label: `${analysis?.htf.selectedBosTimeframe ?? "—"} BOS`,
                  value: analysis?.htf.directionalBos?.kind ?? "NONE",
                  detail: analysis?.htf.directionalBos
                    ? `${analysis.htf.directionalBos.direction} @ ${fmtPrice(analysis.htf.directionalBos.level)}`
                    : "No confirmed break",
                },
                {
                  label: "Active POI",
                  value: analysis?.confluences.activeZone?.kind ?? "NONE",
                  detail: analysis?.confluences.activeZone
                    ? `${fmtPrice(analysis.confluences.activeZone.bottom)}–${fmtPrice(analysis.confluences.activeZone.top)}`
                    : "No fresh tap",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-white/[0.055] bg-base-850/60 px-3 py-2.5">
                  <div className="micro-label">{item.label}</div>
                  <div
                    className={cn(
                      "mt-1.5 truncate text-[12px] font-semibold",
                      item.value === "BULLISH" || item.value === "LONG" ? "text-bull" : item.value === "BEARISH" || item.value === "SHORT" ? "text-bear" : "text-ink-200",
                    )}
                  >
                    {item.value}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] text-ink-500">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="micro-label">Decision path</span>
                <GateProgress items={evidence} />
              </div>
              <div className="space-y-1.5">
                {evidence.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        item.status === "PASS" ? "bg-bull" : item.status === "FAIL" ? "bg-bear" : item.status === "WAIT" ? "bg-warn" : "bg-ink-600",
                      )}
                    />
                    <span className="w-[124px] shrink-0 truncate text-[10px] text-ink-400">{item.label}</span>
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.045]">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          item.status === "PASS" ? "w-full bg-bull/70" : item.status === "FAIL" ? "w-full bg-bear/50" : item.status === "WAIT" ? "w-1/2 bg-warn/50" : "w-1/4 bg-ink-600",
                        )}
                      />
                    </div>
                    <span className="w-8 text-right text-[8px] font-semibold uppercase tracking-wider text-ink-500">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="micro-label">Current reasoning</span>
                <span className="text-[9px] text-ink-500">{criticalCount ? `${passedCritical}/${criticalCount} critical` : "—"}</span>
              </div>
              <div className="rounded-md border border-white/[0.055] bg-black/20 p-3">
                <div className="flex items-start gap-2">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <p className="text-[10px] leading-relaxed text-ink-400">{analysis?.setup.reason ?? "Loading strategy state…"}</p>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {analysis?.confluences.labels.length ? (
                    analysis.confluences.labels.map((label) => (
                      <Badge key={label} variant="bull">
                        {label}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="dark">No signal confluences yet</Badge>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-md border border-white/[0.05] px-2.5 py-2 text-[9px] text-ink-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-bull/70" /> Engine {analysis?.meta.engineVersion ?? "—"}
                </span>
                <span>{analysis ? `Evaluated ${fmtTime(analysis.asOf, true)} ET` : "—"}</span>
              </div>
            </div>
          </div>
        </Panel>

        <SignalTicket analysis={analysis} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.1fr)_minmax(300px,0.85fr)]">
        <Panel
          title="Validation checklist"
          subtitle="Hard gates read top to bottom"
          icon={<ShieldCheck />}
          action={<StatusSummary items={evidence} />}
          bodyClassName="p-2.5"
        >
          <ChecklistList items={evidence} compact />
        </Panel>

        <Panel
          title="Liquidity map"
          subtitle="PDH / PDL · sessions · equal highs & lows"
          icon={<Layers />}
          action={<Badge variant="dark">{analysis?.liquidity.levels.length ?? 0} LEVELS</Badge>}
          flush
        >
          <LiquidityMap analysis={analysis} compact />
          <div className="border-t border-white/[0.055] px-3.5 py-2.5">
            <div className="flex items-center justify-between text-[10px] text-ink-500">
              <span>Sweeps in lookback</span>
              <span className="numeric text-ink-300">{analysis?.liquidity.sweeps.length ?? 0}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {analysis?.liquidity.sweeps.slice(0, 3).map((sweep) => (
                <Badge key={sweep.id} variant={sweep.implication === "LONG" ? "bull" : "bear"}>
                  {sweep.level.kind} · {fmtTime(sweep.time)}
                </Badge>
              )) ?? null}
            </div>
          </div>
        </Panel>

        <Panel
          title="Research snapshot"
          subtitle="MNQ · chronological replay"
          icon={<Zap />}
          action={
            <Button variant="ghost" size="xs" onClick={() => setTab("backtest")}>
              Details
            </Button>
          }
        >
          {running && !result ? (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-[11px] text-ink-500">
              <Timer className="h-5 w-5 animate-pulse text-accent" />
              Running chronological backtest…
            </div>
          ) : error ? (
            <div className="p-1 text-[11px] text-bear">{error}</div>
          ) : result ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <div className="micro-label">Net P&L</div>
                  <div className={cn("numeric mt-1 text-[24px] font-semibold", result.metrics.netPnl >= 0 ? "text-bull" : "text-bear")}>
                    {fmtMoney(result.metrics.netPnl, { sign: true })}
                  </div>
                </div>
                <div className="text-right text-[10px] text-ink-500">
                  <div>{result.metrics.totalTrades} trades</div>
                  <div>{fmtPct(result.metrics.winRate)} win rate</div>
                </div>
              </div>
              <EquityCurve points={result.equityCurve} startingBalance={result.startingBalance} height={82} compact />
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                <SnapshotStat label="PF" value={result.metrics.profitFactorInfinite ? "∞" : result.metrics.profitFactor.toFixed(2)} />
                <SnapshotStat label="Expectancy" value={`${result.metrics.expectancyR >= 0 ? "+" : ""}${result.metrics.expectancyR.toFixed(2)}R`} />
                <SnapshotStat label="Max DD" value={fmtMoney(result.metrics.maxDrawdown)} />
              </div>
              <div className="mt-3 space-y-1">
                {result.trades.slice(-3).reverse().map((trade) => (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => {
                      setDay(tradingDayKey(trade.entryTime));
                      setCursor(trade.entryTime);
                      setTab("charts");
                    }}
                    className="flex w-full items-center justify-between rounded border border-transparent px-1.5 py-1 text-left transition hover:border-white/[0.06] hover:bg-white/[0.025]"
                  >
                    <span className="flex items-center gap-1.5 text-[10px] text-ink-400">
                      <span className={trade.direction === "LONG" ? "text-bull" : "text-bear"}>{trade.direction}</span>
                      {fmtDate(trade.entryTime)} · {fmtTime(trade.entryTime)}
                    </span>
                    <span className={cn("numeric text-[10px]", trade.pnl >= 0 ? "text-bull" : "text-bear")}>{fmtMoney(trade.pnl, { sign: true })}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-[11px] text-ink-500">No backtest result yet.</div>
          )}
        </Panel>
      </div>

      <Panel
        title="Execution posture"
        subtitle="What the desk is allowed to do at this exact replay timestamp"
        icon={<Activity />}
        action={<Badge variant={signal ? "pass" : "wait"} dot>{signal ? "TRADE AUTHORIZED" : "NO TRADE"}</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-white/[0.055] bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-bull" />
              <span className="text-[11px] font-medium text-ink-200">Risk envelope</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <PostureStat label="Account" value={fmtMoney(settings.accountSize, { compact: true })} />
              <PostureStat label="Risk / trade" value={`${settings.riskPct}%`} />
              <PostureStat label="Instrument" value={settings.defaultInstrument} />
              <PostureStat label="Max trades" value="1 / session" />
            </div>
          </div>
          <div className="rounded-md border border-white/[0.055] bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-medium text-ink-200">Timing</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <PostureStat label="Window" value={`${config.observationStart}–${config.observationEnd}`} />
              <PostureStat label="Window state" value={analysis?.inWindow ? "OPEN" : "CLOSED"} />
              <PostureStat label="Trigger freshness" value={`${config.entryBosFreshnessMinutes} min`} />
              <PostureStat label="Exit cut-off" value={result?.config.exitTime ?? "15:55"} />
            </div>
          </div>
          <div className="rounded-md border border-white/[0.055] bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-warn" />
              <span className="text-[11px] font-medium text-ink-200">Trade plan</span>
            </div>
            {signal ? (
              <div className="mt-2 space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-ink-500">Direction</span><span className={signal.direction === "LONG" ? "text-bull" : "text-bear"}>{signal.direction}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Entry / stop</span><span className="numeric text-ink-200">{fmtPrice(signal.entry)} / {fmtPrice(signal.stop)}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Target</span><span className="numeric text-bull">{fmtPrice(signal.target)}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Grade</span><span className="text-ink-200">{signal.grade} · {signal.score}</span></div>
              </div>
            ) : (
              <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
                No executable setup. The desk stays flat until the checklist reaches TRIGGERED inside the observation window.
              </p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/[0.05] bg-black/20 px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div className="numeric mt-0.5 text-[10px] font-medium text-ink-200">{value}</div>
    </div>
  );
}

function PostureStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div className="numeric mt-0.5 text-[10px] font-medium text-ink-200">{value}</div>
    </div>
  );
}

function lastEventLabel(event: { kind: string; direction: string; time: number } | null | undefined): string {
  if (!event) return "No confirmed event";
  return `${event.kind} ${event.direction.toLowerCase()} · ${fmtTime(event.time)}`;
}
