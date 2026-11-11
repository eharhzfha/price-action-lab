import { describe, expect, it } from "vitest";
import { analyzeStructure, findPivots } from "@/lib/engine/candles";
import { detectFvgs } from "@/lib/engine/confluence";
import { detectLiquiditySweeps } from "@/lib/engine/liquidity";
import { atNyTime } from "@/lib/engine/time";
import type { Candle } from "@/lib/engine/types";

function candle(time: number, open: number, high: number, low: number, close: number): Candle {
  return { time, open, high, low, close, volume: 100 };
}

describe("market structure", () => {
  it("confirms pivots only after the lookback window", () => {
    const candles = [
      candle(1, 9, 10, 8, 9),
      candle(2, 10, 11, 9, 10),
      candle(3, 11, 15, 10, 14),
      candle(4, 13, 11, 9, 10),
      candle(5, 9, 10, 8, 9),
      candle(6, 10, 16, 9, 16),
    ];
    const pivots = findPivots(candles, 2);
    const swingHigh = pivots.find((pivot) => pivot.kind === "HIGH" && pivot.price === 15);
    expect(swingHigh).toBeDefined();
    expect(swingHigh?.confirmedIndex).toBe(4);
  });

  it("emits a bullish BOS once a confirmed swing high is closed through", () => {
    const candles = [
      candle(1, 9, 10, 8, 9),
      candle(2, 10, 11, 7, 10),
      candle(3, 11, 15, 6, 14),
      candle(4, 13, 11, 7, 10),
      candle(5, 9, 10, 8, 9),
      candle(6, 10, 16, 15, 16),
    ];
    const structure = analyzeStructure(candles, "5M", 2, 10);
    expect(structure.direction).toBe("BULLISH");
    expect(structure.lastEvent?.kind).toBe("BOS");
    expect(structure.lastEvent?.direction).toBe("BULLISH");
    expect(structure.lastEvent?.level).toBe(15);
  });
});

describe("liquidity sweeps", () => {
  it("detects a buy-side stop run that closes back below the level", () => {
    const time = atNyTime("2026-11-06", "10:00");
    const candles = [
      candle(time - 300, 109, 109.5, 108.5, 109),
      candle(time - 240, 109, 110, 108.75, 109.25),
      candle(time - 180, 109.25, 110.25, 109, 109.5),
      candle(time, 109.5, 111, 109, 109.25),
    ];
    const sweeps = detectLiquiditySweeps(
      candles,
      time,
      [
        {
          key: "PDH",
          label: "Previous Day High",
          kind: "PDH",
          price: 110,
          side: "BUY_SIDE",
          distance: 0,
          formedAt: time - 3600,
        },
      ],
      120,
    );
    expect(sweeps.length).toBeGreaterThan(0);
    const sweep = sweeps.find((item) => item.level.key === "PDH");
    expect(sweep?.implication).toBe("SHORT");
    expect(sweep?.penetration).toBeCloseTo(1, 5);
  });
});

describe("fair value gaps", () => {
  it("detects a bullish three-candle imbalance", () => {
    const candles = [
      candle(100, 100, 101, 99, 100),
      candle(160, 100, 102, 100, 101),
      candle(220, 103, 104, 102, 103),
    ];
    const zones = detectFvgs(candles, 220, 180, 0.25, 0.5);
    expect(zones).toHaveLength(1);
    expect(zones[0].kind).toBe("FVG");
    expect(zones[0].direction).toBe("LONG");
    expect(zones[0].bottom).toBe(101);
    expect(zones[0].top).toBe(102);
  });
});
