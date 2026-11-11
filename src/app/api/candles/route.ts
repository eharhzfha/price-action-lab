import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "@/lib/engine/csv";
import { generateSampleDataset } from "@/lib/data/generator";
import type { Candle } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CandlesPayload {
  candles: Candle[];
  start: number;
  end: number;
  count: number;
  warnings: string[];
  source: string;
  cached?: boolean;
}

let cache: CandlesPayload | null = null;

export async function GET() {
  if (cache) return NextResponse.json({ ...cache, cached: true });

  try {
    const file = path.join(process.cwd(), "data", "sample_nq.csv");
    const text = await readFile(file, "utf8");
    const parsed = parseCsv(text);
    if (!parsed.candles.length) throw new Error(parsed.errors.join(" "));

    cache = {
      candles: parsed.candles,
      start: parsed.candles[0].time,
      end: parsed.candles[parsed.candles.length - 1].time,
      count: parsed.candles.length,
      warnings: parsed.warnings,
      source: "data/sample_nq.csv",
    };
    return NextResponse.json({ ...cache, cached: false });
  } catch (error) {
    const dataset = generateSampleDataset();
    cache = {
      candles: dataset.candles,
      start: dataset.start,
      end: dataset.end,
      count: dataset.candles.length,
      warnings: ["CSV not found — served the built-in generator instead."],
      source: "generated",
    };
    return NextResponse.json({
      ...cache,
      cached: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
