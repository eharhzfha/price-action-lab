import { DateTime } from "luxon";
import { NY_ZONE, nyDateTime } from "./time";
import type { Candle } from "./types";

export interface CsvParseResult {
  candles: Candle[];
  errors: string[];
  warnings: string[];
  rows: number;
  skipped: number;
  columns: string[];
  delimiter: string;
  timezone: string;
}

export interface CsvParseOptions {
  timezone?: string;
}

const TIME_ALIASES = ["timestamp", "time", "datetime", "date_time", "date time", "opentime", "open_time", "date"];
const OPEN_ALIASES = ["open", "o"];
const HIGH_ALIASES = ["high", "h"];
const LOW_ALIASES = ["low", "l"];
const CLOSE_ALIASES = ["close", "c", "last", "price"];
const VOLUME_ALIASES = ["volume", "vol", "v"];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/^\uFEFF/, "").replace(/[^a-z0-9_ ]/g, "");
}

function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.trim().replace(/^"|"$/g, ""));
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join("\n");
  const counts = {
    ",": (sample.match(/,/g) ?? []).length,
    ";": (sample.match(/;/g) ?? []).length,
    "\t": (sample.match(/\t/g) ?? []).length,
  };
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) return "\t";
  return ",";
}

function parseNumber(value: string | undefined): number {
  if (value === undefined) return NaN;
  const cleaned = value.replace(/[$,\s]/g, "").replace(/^\+/, "");
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseTimestamp(
  value: string,
  timezone: string,
  dateValue?: string,
  timeValue?: string,
): number | null {
  const raw = value.trim();
  if (!raw && !dateValue) return null;

  if (dateValue && timeValue && !/[:T]/.test(dateValue)) {
    return parseTimestamp(`${dateValue} ${timeValue}`, timezone);
  }

  // Unix seconds / milliseconds.
  if (/^\d{10}$/.test(raw)) return Number(raw);
  if (/^\d{13}$/.test(raw)) return Math.floor(Number(raw) / 1000);
  if (/^\d{10}\.\d+$/.test(raw)) return Math.floor(Number(raw));

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const iso = DateTime.fromISO(raw, { setZone: true });
    if (iso.isValid) return Math.floor(iso.toSeconds());
  }

  const formats = [
    "yyyy-LL-dd HH:mm:ss",
    "yyyy-LL-dd HH:mm",
    "yyyy-LL-dd'T'HH:mm:ss",
    "yyyy-LL-dd'T'HH:mm",
    "yyyy-LL-dd",
    "LL/dd/yyyy HH:mm:ss",
    "LL/dd/yyyy HH:mm",
    "dd/LL/yyyy HH:mm:ss",
    "dd/LL/yyyy HH:mm",
    "yyyy/LL/dd HH:mm:ss",
    "yyyy/LL/dd HH:mm",
    "LL-dd-yyyy HH:mm:ss",
    "dd-LL-yyyy HH:mm:ss",
    "yyyyLLdd HHmmss",
    "yyyyLLdd",
  ];

  const normalized = raw.replace(/\s+/g, " ").trim();
  for (const format of formats) {
    const dt = DateTime.fromFormat(normalized, format, { zone: timezone });
    if (dt.isValid) return Math.floor(dt.toSeconds());
  }

  const iso = DateTime.fromISO(normalized, { zone: timezone });
  if (iso.isValid) return Math.floor(iso.toSeconds());

  const sql = DateTime.fromSQL(normalized, { zone: timezone });
  if (sql.isValid) return Math.floor(sql.toSeconds());

  return null;
}

/**
 * Flexible CSV importer for M1 futures exports (TradingView, Databento, IQFeed,
 * NinjaTrader, etc.). Timestamps without an explicit zone are interpreted as
 * New York time so the session logic stays correct.
 */
export function parseCsv(text: string, options?: CsvParseOptions): CsvParseResult {
  const timezone = options?.timezone ?? NY_ZONE;
  const errors: string[] = [];
  const warnings: string[] = [];
  const empty: CsvParseResult = {
    candles: [],
    errors,
    warnings,
    rows: 0,
    skipped: 0,
    columns: [],
    delimiter: ",",
    timezone,
  };

  const content = text.replace(/^\uFEFF/, "").trim();
  if (!content) {
    errors.push("The file is empty.");
    return empty;
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    errors.push("The file is empty.");
    return empty;
  }

  const delimiter = detectDelimiter(lines);
  const first = splitLine(lines[0], delimiter);
  const normalizedFirst = first.map(normalizeHeader);
  const hasHeader = normalizedFirst.some((h) => TIME_ALIASES.includes(h) || OPEN_ALIASES.includes(h));

  let headers: string[];
  let dataLines: string[];

  if (hasHeader) {
    headers = normalizedFirst;
    dataLines = lines.slice(1);
  } else {
    headers = ["time", "open", "high", "low", "close", "volume"];
    dataLines = lines;
  }

  const find = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));
  const timeIdx = find(TIME_ALIASES);
  const openIdx = find(OPEN_ALIASES);
  const highIdx = find(HIGH_ALIASES);
  const lowIdx = find(LOW_ALIASES);
  const closeIdx = find(CLOSE_ALIASES);
  const volumeIdx = find(VOLUME_ALIASES);

  if (openIdx < 0 || highIdx < 0 || lowIdx < 0 || closeIdx < 0) {
    errors.push(
      "Missing OHLC columns. Expected headers similar to: timestamp, open, high, low, close, volume.",
    );
    return { ...empty, columns: headers, delimiter };
  }
  if (timeIdx < 0) {
    errors.push("Missing timestamp column. Add a header named timestamp/date/time/datetime.");
    return { ...empty, columns: headers, delimiter };
  }

  // Separate date/time columns (e.g. "Date" + "Time").
  const dateIdx = headers.findIndex((h) => h === "date");
  const explicitTimeIdx = headers.findIndex((h) => h === "time" || h === "date_time" || h === "datetime");
  const useSplitDate = dateIdx >= 0 && explicitTimeIdx >= 0 && dateIdx !== explicitTimeIdx;

  const candles: Candle[] = [];
  let skipped = 0;
  const seen = new Set<number>();
  let duplicates = 0;

  dataLines.forEach((line, rowIndex) => {
    const cells = splitLine(line, delimiter);
    const rowNumber = rowIndex + (hasHeader ? 1 : 0) + 1;
    const timeRaw = cells[timeIdx];
    const parsedTime = useSplitDate
      ? parseTimestamp(timeRaw, timezone, cells[dateIdx], cells[explicitTimeIdx])
      : parseTimestamp(timeRaw, timezone);

    if (!parsedTime) {
      skipped++;
      if (warnings.length < 8) warnings.push(`Row ${rowNumber}: unreadable timestamp "${timeRaw}".`);
      return;
    }

    const open = parseNumber(cells[openIdx]);
    const high = parseNumber(cells[highIdx]);
    const low = parseNumber(cells[lowIdx]);
    const close = parseNumber(cells[closeIdx]);
    const volume = volumeIdx >= 0 ? parseNumber(cells[volumeIdx]) : 0;

    if (![open, high, low, close].every(Number.isFinite)) {
      skipped++;
      if (warnings.length < 8) warnings.push(`Row ${rowNumber}: non-numeric OHLC value.`);
      return;
    }
    if (high < low || high < Math.max(open, close) - 1e-6 || low > Math.min(open, close) + 1e-6) {
      skipped++;
      if (warnings.length < 8) warnings.push(`Row ${rowNumber}: invalid OHLC relationship (high/low).`);
      return;
    }
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      skipped++;
      if (warnings.length < 8) warnings.push(`Row ${rowNumber}: non-positive price.`);
      return;
    }

    if (seen.has(parsedTime)) duplicates++;
    seen.add(parsedTime);

    candles.push({
      time: parsedTime,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) && volume > 0 ? volume : 0,
    });
  });

  candles.sort((a, b) => a.time - b.time);

  if (duplicates > 0) {
    warnings.push(`${duplicates} duplicate timestamp(s) detected; the last occurrence was kept.`);
    const map = new Map<number, Candle>();
    for (const candle of candles) map.set(candle.time, candle);
    candles.length = 0;
    candles.push(...Array.from(map.values()).sort((a, b) => a.time - b.time));
  }

  if (!candles.length) {
    errors.push("No valid candles could be parsed. Check the delimiter and column headers.");
  }

  const gaps = candles.reduce((count, candle, index) => {
    if (index === 0) return count;
    const diff = candle.time - candles[index - 1].time;
    return diff > 61 ? count + 1 : count;
  }, 0);
  if (gaps > 0 && candles.length > 1) {
    warnings.push(`${gaps} gap(s) larger than one minute detected (weekends/maintenance breaks are normal).`);
  }

  return {
    candles,
    errors,
    warnings,
    rows: dataLines.length,
    skipped,
    columns: headers,
    delimiter: delimiter === "\t" ? "TAB" : delimiter,
    timezone,
  };
}

export function candlesToCsv(candles: Candle[]): string {
  const header = "timestamp,open,high,low,close,volume";
  const rows = candles.map((c) => {
    const stamp = nyDateTime(c.time).toFormat("yyyy-LL-dd HH:mm:ss");
    return `${stamp},${c.open},${c.high},${c.low},${c.close},${c.volume}`;
  });
  return [header, ...rows].join("\n");
}
