import { DateTime } from "luxon";
import type { Candle, EngineConfig } from "./types";

export const NY_ZONE = "America/New_York";

const DAY_KEY_CACHE = new Map<number, string>();
const ANCHOR_CACHE = new Map<string, number>();
const BOUNDS_CACHE = new Map<string, ReturnType<typeof buildSessionBounds>>();
const NY_MINUTE_CACHE = new Map<number, number>();

export function nyDateTime(seconds: number): DateTime {
  return DateTime.fromSeconds(seconds, { zone: NY_ZONE });
}

export function toNy(seconds: number, format = "yyyy-LL-dd HH:mm"): string {
  return nyDateTime(seconds).toFormat(format);
}

export function toNyLong(seconds: number): string {
  return nyDateTime(seconds).toFormat("LLL dd, yyyy · HH:mm:ss") + " ET";
}

export function toNyTime(seconds: number): string {
  return nyDateTime(seconds).toFormat("HH:mm");
}

export function nyMinuteOfDay(seconds: number): number {
  const minuteKey = Math.floor(seconds / 60);
  const cached = NY_MINUTE_CACHE.get(minuteKey);
  if (cached !== undefined) return cached;
  const dt = nyDateTime(seconds);
  const value = dt.hour * 60 + dt.minute + dt.second / 60;
  if (NY_MINUTE_CACHE.size > 60000) NY_MINUTE_CACHE.clear();
  NY_MINUTE_CACHE.set(minuteKey, value);
  return value;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(23, h)) * 60 + Math.max(0, Math.min(59, m));
}

export function minutesToHHMM(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Futures trading day starts at 18:00 New York. Timestamps at or after 18:00
 * belong to the next calendar date, which is how exchange sessions are grouped.
 * Results are memoised because this is called for every candle during a test.
 */
export function tradingDayKey(seconds: number): string {
  const minuteKey = Math.floor(seconds / 60);
  const cached = DAY_KEY_CACHE.get(minuteKey);
  if (cached) return cached;
  const dt = nyDateTime(seconds);
  const key = dt.hour >= 18 ? dt.plus({ days: 1 }).toISODate() ?? dt.toISODate()! : dt.toISODate()!;
  if (DAY_KEY_CACHE.size > 60000) DAY_KEY_CACHE.clear();
  DAY_KEY_CACHE.set(minuteKey, key);
  return key;
}

export function tradingDayStart(dayKey: string): number {
  const cached = ANCHOR_CACHE.get(dayKey);
  if (cached !== undefined) return cached;
  const dt = DateTime.fromISO(dayKey, { zone: NY_ZONE }).minus({ days: 1 }).set({
    hour: 18,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const value = Math.floor(dt.toSeconds());
  ANCHOR_CACHE.set(dayKey, value);
  return value;
}

export function atNyTime(dayKey: string, hhmm: string, dayOffset = 0): number {
  const minutes = hhmmToMinutes(hhmm);
  const dt = DateTime.fromISO(dayKey, { zone: NY_ZONE })
    .plus({ days: dayOffset })
    .startOf("day")
    .plus({ minutes });
  return Math.floor(dt.toSeconds());
}

export function observationWindow(dayKey: string, config: Pick<EngineConfig, "observationStart" | "observationEnd">) {
  const start = atNyTime(dayKey, config.observationStart);
  let end = atNyTime(dayKey, config.observationEnd);
  if (end <= start) end += 24 * 3600;
  return { start, end };
}

export function isInObservationWindow(seconds: number, config: Pick<EngineConfig, "observationStart" | "observationEnd">): boolean {
  const day = tradingDayKey(seconds);
  const { start, end } = observationWindow(day, config);
  return seconds >= start && seconds <= end;
}

export function windowLabel(config: Pick<EngineConfig, "observationStart" | "observationEnd">): string {
  return `${config.observationStart} – ${config.observationEnd} ET`;
}

/** Group candles by exchange trading day, preserving chronological order. */
export function groupByTradingDay(candles: Candle[]): Map<string, Candle[]> {
  const map = new Map<string, Candle[]>();
  for (const candle of candles) {
    const key = tradingDayKey(candle.time);
    const bucket = map.get(key);
    if (bucket) bucket.push(candle);
    else map.set(key, [candle]);
  }
  return map;
}

/** Aggregate by fixed buckets anchored to the 18:00 New York session open. */
export function bucketStart(seconds: number, minutes: number): number {
  if (minutes <= 1) return seconds;
  const size = minutes * 60;
  // 5M / 15M / 1H buckets align on epoch boundaries because NY is UTC±whole hours.
  if (minutes <= 60) return Math.floor(seconds / size) * size;
  const day = tradingDayKey(seconds);
  const anchor = tradingDayStart(day);
  return anchor + Math.floor((seconds - anchor) / size) * size;
}

function buildSessionBounds(dayKey: string) {
  const base = DateTime.fromISO(dayKey, { zone: NY_ZONE });
  const at = (d: DateTime, h: number, m = 0) => Math.floor(d.set({ hour: h, minute: m, second: 0 }).toSeconds());
  return {
    asia: {
      start: at(base.minus({ days: 1 }), 19),
      end: at(base, 2),
    },
    london: {
      start: at(base, 2),
      end: at(base, 8),
    },
    nyOpen: {
      start: at(base, 9, 30),
      end: at(base, 9, 45),
    },
    ny: {
      start: at(base, 8, 30),
      end: at(base, 16),
    },
    prior: {
      start: at(base.minus({ days: 1 }), 18),
      end: at(base, 17),
    },
  };
}

export function sessionBounds(dayKey: string) {
  const cached = BOUNDS_CACHE.get(dayKey);
  if (cached) return cached;
  const bounds = buildSessionBounds(dayKey);
  BOUNDS_CACHE.set(dayKey, bounds);
  return bounds;
}
