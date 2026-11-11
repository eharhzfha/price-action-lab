import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateSampleDataset } from "../src/lib/data/generator";
import { candlesToCsv } from "../src/lib/engine/csv";
import { DEFAULT_BACKTEST_CONFIG, runBacktest } from "../src/lib/engine/backtest";
import { analyzeStrategy } from "../src/lib/engine/strategy";
import { toNy } from "../src/lib/engine/time";

const dataset = generateSampleDataset();
const dir = join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });
const csv = candlesToCsv(dataset.candles);
writeFileSync(join(dir, "sample_nq.csv"), csv, "utf8");

console.log(`Generated ${dataset.candles.length} M1 candles`);
console.log(`Range: ${toNy(dataset.start, "yyyy-LL-dd HH:mm")} → ${toNy(dataset.end, "yyyy-LL-dd HH:mm")} ET`);
console.log(`CSV: data/sample_nq.csv (${(csv.length / 1024).toFixed(1)} KB)`);
console.log(`Sessions: ${dataset.stories.length}`);

const config = {
  ...DEFAULT_BACKTEST_CONFIG,
  instrument: "MNQ" as const,
  startingBalance: 100000,
  riskPct: 1,
};

const result = runBacktest(dataset.candles, config);
console.log(
  `Backtest: ${result.trades.length} trades · win rate ${result.metrics.winRate}% · PF ${result.metrics.profitFactor} · net $${result.metrics.netPnl} · DD $${result.metrics.maxDrawdown} · ${result.durationMs}ms`,
);
for (const trade of result.trades) {
  console.log(
    `${trade.direction.padEnd(5)} ${toNy(trade.entryTime, "LL-dd HH:mm")} → ${toNy(
      trade.exitTime,
      "LL-dd HH:mm",
    )} @ ${trade.entryPrice} / ${trade.exitPrice} · ${trade.quantity} MNQ · ${trade.rMultiple}R · $${trade.pnl} · ${trade.exitReason}`,
  );
}

// Inspect the final Friday around the observation window.
const lastDay = dataset.stories[dataset.stories.length - 1].day;
const lastSession = dataset.candles.filter((c) => toNy(c.time, "yyyy-LL-dd") === lastDay);
console.log(`\nFinal session ${lastDay}: ${lastSession.length} candles`);
for (const minute of ["09:49", "09:53", "09:57", "09:59", "10:03", "10:09"]) {
  const candle = lastSession.find((c) => toNy(c.time, "HH:mm") === minute);
  if (candle) {
    const analysis = analyzeStrategy(dataset.candles, config, candle.time);
    console.log(
      `${minute} price ${candle.close} · bias ${analysis.htf.bias4h.direction}/${analysis.htf.bias1h.direction} · state ${analysis.setup.state} · sweep ${analysis.liquidity.activeSweep?.level.label ?? "—"} · zone ${analysis.confluences.activeZone?.kind ?? "—"} · trigger ${analysis.trigger.confirmed} · signal ${analysis.setup.signal ? analysis.setup.signal.grade : "—"}`,
    );
  }
}
