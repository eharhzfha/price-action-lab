import type {
  Candle,
  Direction,
  StructureAnalysis,
  StructureEvent,
  SwingPoint,
  Timeframe,
} from "./types";
import { TIMEFRAME_MINUTES } from "./types";
import { bucketStart } from "./time";

/** Aggregate lower-timeframe candles into higher-timeframe candles. */
export function aggregateCandles(candles: Candle[], timeframe: Timeframe): Candle[] {
  if (timeframe === "1M") return candles.map((c) => ({ ...c }));
  const minutes = TIMEFRAME_MINUTES[timeframe];
  const buckets = new Map<number, Candle>();

  for (const candle of candles) {
    const start = bucketStart(candle.time, minutes);
    const current = buckets.get(start);
    if (!current) {
      buckets.set(start, {
        time: start,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });
    } else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

/**
 * Fractal pivot detection. A pivot is only *knowable* `lookback` bars later,
 * which is tracked by `confirmedIndex` to prevent look-ahead in streaming use.
 */
export function findPivots(candles: Candle[], lookback = 2): SwingPoint[] {
  const pivots: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return pivots;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      const left = candles[i - j];
      const right = candles[i + j];
      if (!(c.high >= left.high && c.high > right.high)) isHigh = false;
      if (!(c.low <= left.low && c.low < right.low)) isLow = false;
      if (!isHigh && !isLow) break;
    }

    if (isHigh) {
      pivots.push({
        index: i,
        time: c.time,
        price: c.high,
        kind: "HIGH",
        confirmedIndex: i + lookback,
      });
    }
    if (isLow) {
      pivots.push({
        index: i,
        time: c.time,
        price: c.low,
        kind: "LOW",
        confirmedIndex: i + lookback,
      });
    }
  }

  return pivots;
}

function emptyStructure(timeframe: Timeframe, lookback: number): StructureAnalysis {
  return {
    timeframe,
    direction: "NEUTRAL",
    swings: [],
    events: [],
    lastEvent: null,
    lastSwingHigh: null,
    lastSwingLow: null,
    rangeHigh: 0,
    rangeLow: 0,
    equilibrium: 0,
    bars: 0,
    lookback,
  };
}

/**
 * Market structure: swing highs/lows, BOS (continuation) and CHoCH (reversal).
 * Every event is generated using only information available at that candle.
 */
export function analyzeStructure(
  candles: Candle[],
  timeframe: Timeframe,
  lookback = 2,
  rangeBars = 60,
): StructureAnalysis {
  if (candles.length < 5) return emptyStructure(timeframe, lookback);

  const pivots = findPivots(candles, lookback);
  const pending = new Map<number, SwingPoint[]>();
  for (const pivot of pivots) {
    const list = pending.get(pivot.confirmedIndex);
    if (list) list.push(pivot);
    else pending.set(pivot.confirmedIndex, [pivot]);
  }

  const events: StructureEvent[] = [];
  let swingHigh: SwingPoint | null = null;
  let swingLow: SwingPoint | null = null;
  let trend: Direction = "NEUTRAL";
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;

  for (let i = 0; i < candles.length; i++) {
    const newlyConfirmed = pending.get(i);
    if (newlyConfirmed) {
      for (const pivot of newlyConfirmed) {
        if (pivot.kind === "HIGH") {
          lastHigh = pivot;
          if (!swingHigh) swingHigh = pivot;
        } else {
          lastLow = pivot;
          if (!swingLow) swingLow = pivot;
        }
      }
    }

    const candle = candles[i];

    if (swingHigh && candle.close > swingHigh.price + 1e-9) {
      const kind = trend === "BEARISH" ? "CHOCH" : "BOS";
      events.push({
        kind,
        direction: "BULLISH",
        time: candle.time,
        price: candle.close,
        level: swingHigh.price,
        index: i,
      });
      trend = "BULLISH";
      swingHigh = null;
    }

    if (swingLow && candle.close < swingLow.price - 1e-9) {
      const kind = trend === "BULLISH" ? "CHOCH" : "BOS";
      events.push({
        kind,
        direction: "BEARISH",
        time: candle.time,
        price: candle.close,
        level: swingLow.price,
        index: i,
      });
      trend = "BEARISH";
      swingLow = null;
    }
  }

  // Fallback: structural sequence of higher highs / lower lows.
  if (trend === "NEUTRAL" && pivots.length >= 4) {
    const highs = pivots.filter((p) => p.kind === "HIGH").slice(-2);
    const lows = pivots.filter((p) => p.kind === "LOW").slice(-2);
    if (highs.length === 2 && lows.length === 2) {
      if (highs[1].price > highs[0].price && lows[1].price > lows[0].price) trend = "BULLISH";
      else if (highs[1].price < highs[0].price && lows[1].price < lows[0].price) trend = "BEARISH";
    }
  }

  const rangeSlice = candles.slice(Math.max(0, candles.length - rangeBars));
  const rangeHigh = Math.max(...rangeSlice.map((c) => c.high));
  const rangeLow = Math.min(...rangeSlice.map((c) => c.low));
  const lastEvent = events.length ? events[events.length - 1] : null;

  if (trend === "NEUTRAL" && lastEvent) trend = lastEvent.direction;

  return {
    timeframe,
    direction: trend,
    swings: pivots,
    events,
    lastEvent,
    lastSwingHigh: lastHigh,
    lastSwingLow: lastLow,
    rangeHigh,
    rangeLow,
    equilibrium: (rangeHigh + rangeLow) / 2,
    bars: candles.length,
    lookback,
  };
}

export function averageTrueRange(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const slice = candles.slice(-Math.max(2, period + 1));
  let sum = 0;
  for (let i = 1; i < slice.length; i++) {
    const c = slice[i];
    const prev = slice[i - 1];
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  }
  return sum / (slice.length - 1);
}

export function trueRange(candle: Candle, previous?: Candle): number {
  if (!previous) return candle.high - candle.low;
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previous.close),
    Math.abs(candle.low - previous.close),
  );
}

/** The latest closed bar excludes a candle still forming at `asOf`. */
export function lastClosedCandle(candles: Candle[], timeframeMinutes: number, asOf: number): Candle | null {
  const size = timeframeMinutes * 60;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time + size <= asOf) return candles[i];
  }
  return null;
}

export function nearestSwingBelow(swings: SwingPoint[], price: number): SwingPoint | null {
  let best: SwingPoint | null = null;
  for (const swing of swings) {
    if (swing.price < price && (!best || swing.price > best.price)) best = swing;
  }
  return best;
}

export function nearestSwingAbove(swings: SwingPoint[], price: number): SwingPoint | null {
  let best: SwingPoint | null = null;
  for (const swing of swings) {
    if (swing.price > price && (!best || swing.price < best.price)) best = swing;
  }
  return best;
}
