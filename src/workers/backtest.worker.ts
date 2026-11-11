import { runBacktest, type BacktestConfig } from "@/lib/engine/backtest";
import type { Candle } from "@/lib/engine/types";

interface Request {
  candles: Candle[];
  config: Partial<BacktestConfig>;
}

self.onmessage = (event: MessageEvent<Request>) => {
  try {
    const result = runBacktest(event.data.candles, event.data.config);
    (self as unknown as { postMessage: (message: unknown) => void }).postMessage({ ok: true, result });
  } catch (error) {
    (self as unknown as { postMessage: (message: unknown) => void }).postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Backtest worker failed",
    });
  }
};

export {};
