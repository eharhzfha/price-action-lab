import type {
  Candle,
  LiquidityLevel,
  LiquiditySweep,
  StructureAnalysis,
} from "./types";
import { groupByTradingDay, nyMinuteOfDay, sessionBounds, tradingDayKey } from "./time";

const PENETRATION = 0.25;
const MAX_SWEEPS = 12;

interface LevelDraft extends LiquidityLevel {
  formedAt: number;
}

function addLevel(
  list: LevelDraft[],
  level: Omit<LevelDraft, "key" | "distance"> & { key?: string; distance?: number },
): void {
  list.push({
    ...level,
    distance: level.distance ?? 0,
    key: level.key ?? level.kind,
  } as LevelDraft);
}

function rangeOf(candles: Candle[], start: number, end: number): { high: number; low: number; count: number } | null {
  let high = -Infinity;
  let low = Infinity;
  let count = 0;
  for (const candle of candles) {
    if (candle.time >= start && candle.time < end) {
      high = Math.max(high, candle.high);
      low = Math.min(low, candle.low);
      count++;
    }
  }
  if (!count) return null;
  return { high, low, count };
}

/**
 * Compute the liquidity map known at `asOf`: previous day high/low,
 * Asian / London / NY opening-range extremes and equal highs/lows.
 */
export function computeLiquidityLevels(
  candles: Candle[],
  asOf: number,
  structure5m: StructureAnalysis,
  equalTolerancePoints = 2,
): {
  levels: LiquidityLevel[];
  eqh: LiquidityLevel[];
  eql: LiquidityLevel[];
  pdh: number | null;
  pdl: number | null;
} {
  const day = tradingDayKey(asOf);
  const bounds = sessionBounds(day);
  const byDay = groupByTradingDay(candles.filter((c) => c.time <= asOf));
  const priorKeys = Array.from(byDay.keys()).filter((key) => key < day).sort();
  const priorKey = priorKeys.length ? priorKeys[priorKeys.length - 1] : null;
  const priorCandles = priorKey ? byDay.get(priorKey) ?? [] : [];
  const priorRange =
    priorCandles.length > 0
      ? {
          high: Math.max(...priorCandles.map((c) => c.high)),
          low: Math.min(...priorCandles.map((c) => c.low)),
        }
      : null;

  const drafts: LevelDraft[] = [];
  const formation = bounds.nyOpen.start;

  if (priorRange) {
    addLevel(drafts, {
      kind: "PDH",
      label: "Previous Day High",
      price: priorRange.high,
      side: "BUY_SIDE",
      distance: 0,
      formedAt: bounds.ny.start,
      key: "PDH",
    });
    addLevel(drafts, {
      kind: "PDL",
      label: "Previous Day Low",
      price: priorRange.low,
      side: "SELL_SIDE",
      distance: 0,
      formedAt: bounds.ny.start,
      key: "PDL",
    });
  }

  const asia = rangeOf(candles, bounds.asia.start, Math.min(bounds.asia.end, asOf));
  const london = rangeOf(candles, bounds.london.start, Math.min(bounds.london.end, asOf));
  const nyOr = rangeOf(candles, bounds.nyOpen.start, Math.min(bounds.nyOpen.end, asOf));

  if (asia && asia.count >= 10) {
    addLevel(drafts, {
      kind: "ASIA_HIGH",
      label: "Asian Session High",
      price: asia.high,
      side: "BUY_SIDE",
      distance: 0,
      formedAt: bounds.asia.end,
      key: "ASIA_HIGH",
    });
    addLevel(drafts, {
      kind: "ASIA_LOW",
      label: "Asian Session Low",
      price: asia.low,
      side: "SELL_SIDE",
      distance: 0,
      formedAt: bounds.asia.end,
      key: "ASIA_LOW",
    });
  }

  if (london && london.count >= 10) {
    addLevel(drafts, {
      kind: "LONDON_HIGH",
      label: "London Session High",
      price: london.high,
      side: "BUY_SIDE",
      distance: 0,
      formedAt: bounds.london.end,
      key: "LONDON_HIGH",
    });
    addLevel(drafts, {
      kind: "LONDON_LOW",
      label: "London Session Low",
      price: london.low,
      side: "SELL_SIDE",
      distance: 0,
      formedAt: bounds.london.end,
      key: "LONDON_LOW",
    });
  }

  if (nyOr && nyOr.count >= 5 && asOf >= bounds.nyOpen.end) {
    addLevel(drafts, {
      kind: "NY_OPEN_HIGH",
      label: "NY Opening Range High",
      price: nyOr.high,
      side: "BUY_SIDE",
      distance: 0,
      formedAt: bounds.nyOpen.end,
      key: "NY_OPEN_HIGH",
    });
    addLevel(drafts, {
      kind: "NY_OPEN_LOW",
      label: "NY Opening Range Low",
      price: nyOr.low,
      side: "SELL_SIDE",
      distance: 0,
      formedAt: bounds.nyOpen.end,
      key: "NY_OPEN_LOW",
    });
  }

  // Equal highs / lows from confirmed 5M swing pivots in the last four hours.
  const cutoff = asOf - 4 * 3600;
  const recentSwings = structure5m.swings.filter(
    (s) => s.time >= cutoff && s.time <= asOf && s.confirmedIndex < structure5m.bars,
  );
  const eqh: LiquidityLevel[] = [];
  const eql: LiquidityLevel[] = [];

  const cluster = (kind: "HIGH" | "LOW"): LiquidityLevel[] => {
    const points = recentSwings.filter((s) => s.kind === kind).sort((a, b) => a.price - b.price);
    const groups: typeof points[] = [];
    for (const point of points) {
      const group = groups[groups.length - 1];
      if (group && Math.abs(point.price - group[group.length - 1].price) <= equalTolerancePoints) {
        group.push(point);
      } else {
        groups.push([point]);
      }
    }
    return groups
      .filter((g) => g.length >= 2)
      .slice(-3)
      .map((g, i) => {
        const price = g.reduce((sum, p) => sum + p.price, 0) / g.length;
        return {
          key: `${kind === "HIGH" ? "EQH" : "EQL"}_${i}`,
          label: `${kind === "HIGH" ? "Equal Highs" : "Equal Lows"} ×${g.length}`,
          kind: kind === "HIGH" ? ("EQH" as const) : ("EQL" as const),
          price,
          side: kind === "HIGH" ? ("BUY_SIDE" as const) : ("SELL_SIDE" as const),
          distance: 0,
          touches: g.length,
          formedAt: Math.max(...g.map((p) => p.time)) + 10 * 60,
        };
      });
  };

  eqh.push(...cluster("HIGH"));
  eql.push(...cluster("LOW"));

  for (const level of [...eqh, ...eql]) {
    drafts.push({
      ...level,
      formedAt: level.formedAt ?? formation,
    });
  }

  const price = candles.length ? candles[candles.length - 1].close : 0;
  const levels: LiquidityLevel[] = drafts
    .filter((d) => d.price > 0)
    .map((level) => ({
      ...level,
      distance: Number((level.price - price).toFixed(2)),
    }))
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));

  return {
    levels,
    eqh,
    eql,
    pdh: priorRange?.high ?? null,
    pdl: priorRange?.low ?? null,
  };
}

/**
 * Detect stop-runs: wicks through a known level that close back inside.
 * The NY session level is evaluated as a rolling prefix so that a new
 * session extreme cannot retroactively invalidate its own sweep.
 */
export function detectLiquiditySweeps(
  candles: Candle[],
  asOf: number,
  levels: LiquidityLevel[],
  lookbackMinutes = 90,
  options?: { equalTolerance?: number },
): LiquiditySweep[] {
  if (candles.length === 0) return [];
  const cutoff = asOf - lookbackMinutes * 60;
  const day = tradingDayKey(asOf);
  const bounds = sessionBounds(day);
  const lastIndex = candles.length - 1;
  const sweeps: LiquiditySweep[] = [];

  const drafts: LevelDraft[] = levels.map((level) => ({
    ...level,
    formedAt:
      level.formedAt ??
      (level.kind === "PDH" || level.kind === "PDL"
        ? bounds.ny.start
        : level.kind.startsWith("EQ")
          ? asOf - 4 * 3600
          : level.kind.startsWith("ASIA")
            ? bounds.asia.end
            : level.kind.startsWith("LONDON")
              ? bounds.london.end
              : bounds.nyOpen.end),
  }));

  // NY session prefix levels (08:30 -> current), used for rolling sweeps.
  let runningHigh = -Infinity;
  let runningLow = Infinity;
  let nyBars = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    if (candle.time > asOf) continue;

    const inNySession = candle.time >= bounds.ny.start && candle.time < asOf;
    const inLookback = candle.time >= cutoff;

    if (inNySession) {
      // Test the sweep against the session extreme *before* this candle.
      if (
        inLookback &&
        candle.time >= bounds.nyOpen.end &&
        nyBars >= 10 &&
        runningHigh > -Infinity &&
        runningLow < Infinity
      ) {
        if (candle.high > runningHigh + PENETRATION && candle.close < runningHigh) {
          sweeps.push({
            id: `NY_SESSION_HIGH_${candle.time}`,
            level: {
              key: "NY_SESSION_HIGH",
              label: "NY Session High",
              kind: "NY_OPEN_HIGH",
              price: runningHigh,
              side: "BUY_SIDE",
              distance: 0,
              formedAt: bounds.nyOpen.end,
            },
            side: "BUY_SIDE",
            time: candle.time,
            sweepPrice: candle.high,
            levelPrice: runningHigh,
            penetration: Number((candle.high - runningHigh).toFixed(2)),
            implication: "SHORT",
            candlesAgo: lastIndex - i,
          });
        }
        if (candle.low < runningLow - PENETRATION && candle.close > runningLow) {
          sweeps.push({
            id: `NY_SESSION_LOW_${candle.time}`,
            level: {
              key: "NY_SESSION_LOW",
              label: "NY Session Low",
              kind: "NY_OPEN_LOW",
              price: runningLow,
              side: "SELL_SIDE",
              distance: 0,
              formedAt: bounds.nyOpen.end,
            },
            side: "SELL_SIDE",
            time: candle.time,
            sweepPrice: candle.low,
            levelPrice: runningLow,
            penetration: Number((runningLow - candle.low).toFixed(2)),
            implication: "LONG",
            candlesAgo: lastIndex - i,
          });
        }
      }
      runningHigh = Math.max(runningHigh, candle.high);
      runningLow = Math.min(runningLow, candle.low);
      nyBars++;
    }

    if (!inLookback) continue;

    for (const level of drafts) {
      if (candle.time < (level.formedAt ?? 0)) continue;
      if (level.side === "BUY_SIDE") {
        if (candle.high > level.price + PENETRATION && candle.close < level.price) {
          sweeps.push({
            id: `${level.key}_${candle.time}`,
            level,
            side: "BUY_SIDE",
            time: candle.time,
            sweepPrice: candle.high,
            levelPrice: level.price,
            penetration: Number((candle.high - level.price).toFixed(2)),
            implication: "SHORT",
            candlesAgo: lastIndex - i,
          });
        }
      } else if (candle.low < level.price - PENETRATION && candle.close > level.price) {
        sweeps.push({
          id: `${level.key}_${candle.time}`,
          level,
          side: "SELL_SIDE",
          time: candle.time,
          sweepPrice: candle.low,
          levelPrice: level.price,
          penetration: Number((level.price - candle.low).toFixed(2)),
          implication: "LONG",
          candlesAgo: lastIndex - i,
        });
      }
    }
  }

  // Keep only the most recent sweep per level, avoid noise, newest first.
  const seen = new Set<string>();
  const deduped = sweeps
    .sort((a, b) => b.time - a.time)
    .filter((sweep) => {
      const key = `${sweep.level.key}_${sweep.side}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return deduped.slice(0, MAX_SWEEPS);
}

export function activeSweepFor(
  sweeps: LiquiditySweep[],
  direction: "LONG" | "SHORT",
): LiquiditySweep | null {
  const side = direction === "LONG" ? "SELL_SIDE" : "BUY_SIDE";
  return sweeps.find((s) => s.side === side) ?? null;
}

export function sessionMomentum(candles: Candle[], asOf: number): {
  sessionChangePct: number;
  sessionHigh: number;
  sessionLow: number;
  openingRange: number;
} {
  const day = tradingDayKey(asOf);
  const bounds = sessionBounds(day);
  const session = candles.filter((c) => c.time >= bounds.ny.start && c.time <= asOf);
  if (!session.length) return { sessionChangePct: 0, sessionHigh: 0, sessionLow: 0, openingRange: 0 };
  const first = session[0].open;
  const last = session[session.length - 1].close;
  const orb = session.filter((c) => c.time < bounds.nyOpen.end);
  const orbHigh = orb.length ? Math.max(...orb.map((c) => c.high)) : 0;
  const orbLow = orb.length ? Math.min(...orb.map((c) => c.low)) : 0;
  return {
    sessionChangePct: first ? ((last - first) / first) * 100 : 0,
    sessionHigh: Math.max(...session.map((c) => c.high)),
    sessionLow: Math.min(...session.map((c) => c.low)),
    openingRange: orbHigh - orbLow,
  };
}

export function minutesSinceOpen(asOf: number): number {
  return nyMinuteOfDay(asOf) - (9 * 60 + 30);
}
