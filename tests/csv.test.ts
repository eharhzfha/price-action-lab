import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/engine/csv";
import { toNyTime } from "@/lib/engine/time";

describe("CSV importer", () => {
  it("parses a New York timestamp and OHLCV rows", () => {
    const csv = [
      "timestamp,open,high,low,close,volume",
      "2026-11-06 09:30:00,18500,18505,18495,18502,120",
      "2026-11-06 09:31:00,18502,18510,18500,18508,90",
    ].join("\n");
    const parsed = parseCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.candles).toHaveLength(2);
    expect(parsed.skipped).toBe(0);
    expect(toNyTime(parsed.candles[0].time)).toBe("09:30");
    expect(parsed.candles[1].close).toBe(18508);
    expect(parsed.timezone).toBe("America/New_York");
  });

  it("accepts semicolon delimiters and alternate headers", () => {
    const csv = ["Date;Open;High;Low;Close;Vol", "11/06/2026 09:30;100;101;99;100.5;55"].join("\n");
    const parsed = parseCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.delimiter).toBe(";");
    expect(parsed.candles).toHaveLength(1);
    expect(parsed.candles[0].close).toBe(100.5);
  });

  it("rejects rows with invalid OHLC relationships and missing columns", () => {
    const invalid = parseCsv("timestamp,open,high,low,close\n2026-11-06 09:30:00,100,99,101,100");
    expect(invalid.candles).toHaveLength(0);
    expect(invalid.skipped).toBe(1);

    const missing = parseCsv("timestamp,price\n2026-11-06 09:30:00,100");
    expect(missing.errors[0]).toMatch(/Missing OHLC/);
  });

  it("understands unix second timestamps", () => {
    const parsed = parseCsv("time,open,high,low,close,volume\n1791388200,100,101,99,100,10");
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.candles[0].time).toBe(1791388200);
  });
});
