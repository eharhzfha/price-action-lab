import { describe, expect, it } from "vitest";
import { analyzeStrategy } from "@/lib/engine/strategy";
import { atNyTime, tradingDayKey } from "@/lib/engine/time";
import { generateSampleDataset } from "@/lib/data/generator";

function normalized(analysis: ReturnType<typeof analyzeStrategy>) {
  return JSON.parse(
    JSON.stringify({
      ...analysis,
      meta: { ...analysis.meta, evaluatedAt: "fixed" },
    }),
  );
}

describe("strategy engine integrity", () => {
  it("never reads candles after the as-of cursor", () => {
    const dataset = generateSampleDataset();
    const lastDay = dataset.stories[dataset.stories.length - 1].day;
    const asOf = atNyTime(lastDay, "09:57");
    const baseline = analyzeStrategy(dataset.candles, undefined, asOf);

    const mutated = dataset.candles.map((candle) =>
      candle.time > asOf
        ? {
            ...candle,
            open: candle.open + 500,
            high: candle.high + 500,
            low: candle.low + 500,
            close: candle.close + 500,
            volume: candle.volume + 9999,
          }
        : candle,
    );
    const afterFutureMutation = analyzeStrategy(mutated, undefined, asOf);
    expect(normalized(afterFutureMutation)).toEqual(normalized(baseline));

    const truncated = dataset.candles.filter((candle) => candle.time <= asOf);
    expect(normalized(analyzeStrategy(truncated, undefined, asOf))).toEqual(normalized(baseline));
  });

  it("produces a valid final-session signal with structural risk", () => {
    const dataset = generateSampleDataset();
    const lastDay = dataset.stories[dataset.stories.length - 1].day;
    const asOf = atNyTime(lastDay, "09:57");
    const analysis = analyzeStrategy(dataset.candles, undefined, asOf);

    expect(tradingDayKey(asOf)).toBe(lastDay);
    expect(analysis.setup.signal).not.toBeNull();
    const signal = analysis.setup.signal!;
    expect(signal.direction).toBe("LONG");
    expect(signal.grade).toMatch(/^[AB]/);
    expect(signal.entry).toBeGreaterThan(signal.stop);
    expect(signal.target).toBeGreaterThan(signal.entry);
    expect(signal.riskPoints).toBeGreaterThan(0.5);
    expect(signal.triggerTime).toBeGreaterThanOrEqual(atNyTime(lastDay, "09:50"));
    expect(signal.triggerTime).toBeLessThanOrEqual(atNyTime(lastDay, "10:10"));
    expect(analysis.checklist.filter((item) => item.critical).every((item) => item.status === "PASS")).toBe(true);
  });

  it("refuses to trade without resolved HTF context", () => {
    const dataset = generateSampleDataset();
    const firstDay = dataset.stories[0].day;
    const analysis = analyzeStrategy(dataset.candles, undefined, atNyTime(firstDay, "09:57"));
    expect(analysis.htf.unclear).toBe(true);
    expect(analysis.setup.state).toBe("CONTEXT_UNCLEAR");
    expect(analysis.setup.signal).toBeNull();
  });
});
