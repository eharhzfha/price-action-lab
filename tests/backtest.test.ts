import { describe, expect, it } from "vitest";
import { DEFAULT_BACKTEST_CONFIG, runBacktest } from "@/lib/engine/backtest";
import { INSTRUMENTS } from "@/lib/engine/types";
import { tradingDayKey } from "@/lib/engine/time";
import { generateSampleDataset } from "@/lib/data/generator";

const dataset = generateSampleDataset();

describe("chronological backtest", () => {
  it("runs the full dataset with honest trade invariants", () => {
    const config = {
      ...DEFAULT_BACKTEST_CONFIG,
      instrument: "MNQ" as const,
      startingBalance: 100000,
      riskPct: 1,
      warmupDays: 2,
    };
    const result = runBacktest(dataset.candles, config);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.metrics.totalTrades).toBe(result.trades.length);
    expect(result.finalBalance).toBeCloseTo(100000 + result.metrics.netPnl, 1);

    const days = Array.from(new Set(dataset.candles.map((candle) => tradingDayKey(candle.time)))).sort();
    const seenDays = new Set<string>();

    for (const trade of result.trades) {
      expect(trade.quantity).toBeGreaterThan(0);
      expect(trade.riskPoints).toBeGreaterThan(0.5);
      expect(trade.exitTime).toBeGreaterThanOrEqual(trade.entryTime);
      expect(trade.pnl).toBeCloseTo(trade.grossPnl - trade.fees, 2);
      expect(trade.entryPrice).toBeGreaterThan(0);
      expect(trade.stopPrice).toBeGreaterThan(0);
      expect(trade.targetPrice).toBeGreaterThan(0);
      if (trade.direction === "LONG") {
        expect(trade.stopPrice).toBeLessThan(trade.entryPrice);
        expect(trade.targetPrice).toBeGreaterThan(trade.entryPrice);
      } else {
        expect(trade.stopPrice).toBeGreaterThan(trade.entryPrice);
        expect(trade.targetPrice).toBeLessThan(trade.entryPrice);
      }
      const day = tradingDayKey(trade.entryTime);
      expect(day).not.toBe(days[0]);
      expect(day).not.toBe(days[1]);
      expect(seenDays.has(day)).toBe(false);
      seenDays.add(day);
    }
  }, 60000);

  it("sizes NQ with the correct dollar point value", () => {
    const config = { ...DEFAULT_BACKTEST_CONFIG, instrument: "NQ" as const, riskPct: 0.5, maxTradesPerDay: 1 };
    const result = runBacktest(dataset.candles.slice(0, 9000), config);
    for (const trade of result.trades) {
      expect(trade.riskDollars).toBeCloseTo(trade.riskPoints * INSTRUMENTS.NQ.pointValue * trade.quantity, 2);
      expect(trade.riskDollars).toBeLessThanOrEqual(config.startingBalance * config.riskPct / 100 * trade.quantity + 0.01);
    }
  }, 60000);

  it("returns an empty metrics set when no trades are possible", () => {
    const result = runBacktest(dataset.candles.slice(0, 500), { ...DEFAULT_BACKTEST_CONFIG, warmupDays: 2 });
    expect(result.trades).toHaveLength(0);
    expect(result.metrics.totalTrades).toBe(0);
    expect(result.metrics.netPnl).toBe(0);
    expect(result.equityCurve).toHaveLength(0);
  });
});
