import { analyzeStrategy } from "./strategy";
import { buildEquityCurve, computeMetrics, type EquityPoint, type PerformanceMetrics } from "./metrics";
import { isInObservationWindow, nyMinuteOfDay, toNyTime, tradingDayKey } from "./time";
import {
  DEFAULT_ENGINE_CONFIG,
  INSTRUMENTS,
  type Candle,
  type EngineConfig,
  type Instrument,
  type TradeDirection,
} from "./types";

export interface BacktestConfig extends EngineConfig {
  startingBalance: number;
  riskPct: number;
  instrument: Instrument;
  commissionPerSide: number;
  slippageTicks: number;
  maxTradesPerDay: number;
  maxHoldMinutes: number;
  exitTime: string;
  warmupDays: number;
}

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  ...DEFAULT_ENGINE_CONFIG,
  startingBalance: 100000,
  riskPct: 1,
  instrument: "NQ",
  commissionPerSide: 2.5,
  slippageTicks: 1,
  maxTradesPerDay: 1,
  maxHoldMinutes: 180,
  exitTime: "15:55",
  warmupDays: 2,
};

export type ExitReason = "TARGET" | "STOP" | "TIME" | "EOD";

export interface BacktestTrade {
  id: string;
  instrument: Instrument;
  direction: TradeDirection;
  setupTime: number;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  targetPrice: number;
  quantity: number;
  riskPoints: number;
  riskDollars: number;
  grossPnl: number;
  fees: number;
  pnl: number;
  rMultiple: number;
  mfePoints: number;
  maePoints: number;
  exitReason: ExitReason;
  grade: "A+" | "A" | "B" | "C" | null;
  confluences: string[];
  entryHour: string;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  metrics: PerformanceMetrics;
  equityCurve: EquityPoint[];
  startingBalance: number;
  finalBalance: number;
  datasetStart: number;
  datasetEnd: number;
  days: number;
  daysEvaluated: number;
  evaluations: number;
  warmupSkipped: number;
  durationMs: number;
}

interface OpenTrade {
  direction: TradeDirection;
  entryIndex: number;
  entryTime: number;
  entryPrice: number;
  stop: number;
  target: number;
  quantity: number;
  riskPoints: number;
  riskDollars: number;
  fees: number;
  mfe: number;
  mae: number;
  setupTime: number;
  grade: BacktestTrade["grade"];
  confluences: string[];
}

interface PendingEntry {
  direction: TradeDirection;
  stop: number;
  setupTime: number;
  grade: BacktestTrade["grade"];
  confluences: string[];
  signalDay: string;
}

function lowerBound(candles: Candle[], time: number): number {
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function formatHour(seconds: number): string {
  return toNyTime(seconds);
}

/**
 * Strictly chronological, bar-by-bar backtest. At minute `i` the strategy only
 * receives candles `[0..i]`; entry is filled at the next bar open. Intrabar
 * ambiguity is resolved conservatively (stop before target).
 */
export function runBacktest(
  candles: Candle[],
  configInput?: Partial<BacktestConfig>,
  onProgress?: (progress: { day: number; days: number; trades: number }) => void,
): BacktestResult {
  const startedAt = Date.now();
  const config: BacktestConfig = { ...DEFAULT_BACKTEST_CONFIG, ...(configInput ?? {}) };
  const spec = INSTRUMENTS[config.instrument] ?? INSTRUMENTS.NQ;
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const trades: BacktestTrade[] = [];
  const slippagePoints = config.slippageTicks * spec.tickSize;
  let balance = config.startingBalance;
  let open: OpenTrade | null = null;
  let pending: PendingEntry | null = null;
  let evaluations = 0;
  let warmupSkipped = 0;
  let tradesToday = 0;
  let currentDay = "";
  let equity: EquityPoint[] = [];

  const firstTime = sorted[0]?.time ?? 0;
  const dayKeys = Array.from(new Set(sorted.map((c) => tradingDayKey(c.time))));
  const exitMinute = (() => {
    const [h, m] = config.exitTime.split(":").map(Number);
    return h * 60 + m;
  })();

  const closeTrade = (exitIndex: number, exitPrice: number, reason: ExitReason) => {
    if (!open) return;
    const candle = sorted[Math.min(exitIndex, sorted.length - 1)];
    const dir = open.direction === "LONG" ? 1 : -1;
    const grossPnl = (exitPrice - open.entryPrice) * dir * open.quantity * spec.pointValue;
    const pnl = grossPnl - open.fees;
    const rMultiple = open.riskDollars > 0 ? pnl / open.riskDollars : 0;
    balance += pnl;
    trades.push({
      id: `BT_${open.entryTime}_${trades.length}`,
      instrument: config.instrument,
      direction: open.direction,
      setupTime: open.setupTime,
      entryTime: open.entryTime,
      exitTime: candle.time,
      entryPrice: Number(open.entryPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
      stopPrice: Number(open.stop.toFixed(2)),
      targetPrice: Number(open.target.toFixed(2)),
      quantity: open.quantity,
      riskPoints: Number(open.riskPoints.toFixed(2)),
      riskDollars: Number(open.riskDollars.toFixed(2)),
      grossPnl: Number(grossPnl.toFixed(2)),
      fees: Number(open.fees.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      rMultiple: Number(rMultiple.toFixed(2)),
      mfePoints: Number(open.mfe.toFixed(2)),
      maePoints: Number(open.mae.toFixed(2)),
      exitReason: reason,
      grade: open.grade,
      confluences: open.confluences,
      entryHour: formatHour(open.entryTime),
    });
    open = null;
  };

  for (let i = 0; i < sorted.length; i++) {
    const candle = sorted[i];
    const day = tradingDayKey(candle.time);

    if (day !== currentDay) {
      // Force-close anything carried across the session boundary.
      if (open) closeTrade(i - 1, sorted[i - 1].close + (open.direction === "LONG" ? -slippagePoints : slippagePoints), "EOD");
      if (pending && pending.signalDay !== day) pending = null;
      currentDay = day;
      tradesToday = 0;
      if (onProgress && dayKeys.length) {
        onProgress({ day: dayKeys.indexOf(day) + 1, days: dayKeys.length, trades: trades.length });
      }
    }

    if (dayKeys.indexOf(day) < config.warmupDays) {
      warmupSkipped++;
      continue;
    }

    if (open) {
      const dir = open.direction === "LONG" ? 1 : -1;
      open.mfe = Math.max(open.mfe, (candle.high - open.entryPrice) * dir);
      open.mae = Math.max(open.mae, (open.entryPrice - candle.low) * dir);

      if (open.direction === "LONG") {
        if (candle.low <= open.stop) {
          const fill = Math.min(candle.open, open.stop) - slippagePoints;
          closeTrade(i, fill, "STOP");
        } else if (candle.high >= open.target) {
          const fill = Math.max(candle.open, open.target);
          closeTrade(i, fill, "TARGET");
        }
      } else {
        if (candle.high >= open.stop) {
          const fill = Math.max(candle.open, open.stop) + slippagePoints;
          closeTrade(i, fill, "STOP");
        } else if (candle.low <= open.target) {
          const fill = Math.min(candle.open, open.target);
          closeTrade(i, fill, "TARGET");
        }
      }

      if (open) {
        const minutesHeld = (candle.time - open.entryTime) / 60;
        if (nyMinuteOfDay(candle.time) >= exitMinute || minutesHeld >= config.maxHoldMinutes) {
          const fill = candle.close + (open.direction === "LONG" ? -slippagePoints : slippagePoints);
          closeTrade(i, fill, "TIME");
        }
      }
    }

    if (pending && !open) {
      const sameDay = tradingDayKey(candle.time) === pending.signalDay;
      if (!sameDay) {
        pending = null;
      } else {
        const entryPrice = candle.open + (pending.direction === "LONG" ? slippagePoints : -slippagePoints);
        const riskPoints =
          pending.direction === "LONG" ? entryPrice - pending.stop : pending.stop - entryPrice;

        if (riskPoints > 0.5) {
          const riskDollarsPerContract = riskPoints * spec.pointValue;
          const budget = (balance * config.riskPct) / 100;
          const riskSized = Math.floor(budget / riskDollarsPerContract);
          const marginSized = Math.max(1, Math.floor((balance * 0.5) / spec.estMargin));
          const quantity = Math.min(riskSized, marginSized);

          if (quantity > 0) {
            const fees = config.commissionPerSide * 2 * quantity;
            open = {
              direction: pending.direction,
              entryIndex: i,
              entryTime: candle.time,
              entryPrice,
              stop: pending.stop,
              target:
                pending.direction === "LONG"
                  ? entryPrice + riskPoints * config.rr
                  : entryPrice - riskPoints * config.rr,
              quantity,
              riskPoints,
              riskDollars: riskDollarsPerContract * quantity,
              fees,
              mfe: 0,
              mae: 0,
              setupTime: pending.setupTime,
              grade: pending.grade,
              confluences: pending.confluences,
            };
            tradesToday++;
          }
        }
        pending = null;
      }
    }

    if (open) continue;

    if (
      tradesToday < config.maxTradesPerDay &&
      isInObservationWindow(candle.time, config)
    ) {
      const historyStart = lowerBound(sorted, candle.time - config.historyDays * 86400);
      const history = sorted.slice(historyStart, i + 1);
      const analysis = analyzeStrategy(history, config, candle.time);
      evaluations++;
      const signal = analysis.setup.signal;
      if (signal) {
        pending = {
          direction: signal.direction,
          stop: signal.stop,
          setupTime: candle.time,
          grade: signal.grade,
          confluences: signal.confluences,
          signalDay: day,
        };
      }
    }
  }

  if (open) {
    const last = sorted[sorted.length - 1];
    closeTrade(sorted.length - 1, last.close + (open.direction === "LONG" ? -slippagePoints : slippagePoints), "EOD");
  }

  equity = buildEquityCurve(trades, config.startingBalance);
  const metrics = computeMetrics(trades, config.startingBalance, equity);

  return {
    config,
    trades,
    metrics,
    equityCurve: equity,
    startingBalance: config.startingBalance,
    finalBalance: Number(balance.toFixed(2)),
    datasetStart: firstTime,
    datasetEnd: sorted[sorted.length - 1]?.time ?? 0,
    days: dayKeys.length,
    daysEvaluated: Math.max(0, dayKeys.length - config.warmupDays),
    evaluations,
    warmupSkipped,
    durationMs: Date.now() - startedAt,
  };
}
