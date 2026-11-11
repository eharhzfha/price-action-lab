import { DateTime } from "luxon";
import { NY_ZONE } from "../engine/time";
import type { Candle } from "../engine/types";

/**
 * Deterministic synthetic NQ M1 dataset.
 * It intentionally contains repeatable liquidity-sweep → displacement →
 * FVG retest → 1M BOS sequences so the strategy engine can be demonstrated
 * and tested without a market-data subscription.
 */

type StoryKey = "BULL" | "BEAR" | "CHOP" | "CONFLICT_BEAR" | "TRAP_BULL" | "TRAP_BEAR";

interface Story {
  key: StoryKey;
  label: string;
  points: Partial<Record<MinuteKey, number>>;
}

type MinuteKey =
  | "t1900"
  | "t2200"
  | "t0000"
  | "t0200"
  | "t0400"
  | "t0600"
  | "t0700"
  | "t0800"
  | "t0830"
  | "t0900"
  | "t0915"
  | "t0930"
  | "t0938"
  | "t0943"
  | "t0947"
  | "t0948"
  | "t0951"
  | "t0952"
  | "t0954"
  | "t0956"
  | "t0958"
  | "t1000"
  | "t1002"
  | "t1004"
  | "t1020"
  | "t1200"
  | "t1400"
  | "t1600"
  | "t1700";

const MINUTE_OFFSETS: Record<MinuteKey, number> = {
  t1900: 60,
  t2200: 240,
  t0000: 360,
  t0200: 480,
  t0400: 600,
  t0600: 720,
  t0700: 780,
  t0800: 840,
  t0830: 870,
  t0900: 900,
  t0915: 915,
  t0930: 930,
  t0938: 938,
  t0943: 943,
  t0947: 947,
  t0948: 948,
  t0951: 951,
  t0952: 952,
  t0954: 954,
  t0956: 956,
  t0958: 958,
  t1000: 960,
  t1002: 962,
  t1004: 964,
  t1020: 980,
  t1200: 1080,
  t1400: 1200,
  t1600: 1320,
  t1700: 1380,
};

const STORIES: Record<StoryKey, Story> = {
  BULL: {
    key: "BULL",
    label: "Bullish trend day · London low sweep → 5M BOS",
    points: {
      t1900: 4,
      t2200: 18,
      t0000: 32,
      t0200: 50,
      t0400: 60,
      t0600: 70,
      t0700: 74,
      t0800: 78,
      t0830: 80,
      t0900: 82,
      t0915: 84,
      t0930: 86,
      t0938: 28,
      t0943: 38,
      t0948: 88,
      t0952: 84,
      t0954: 80,
      t0956: 84,
      t0958: 102,
      t1000: 112,
      t1004: 116,
      t1020: 130,
      t1200: 225,
      t1400: 205,
      t1600: 185,
      t1700: 180,
    },
  },
  BEAR: {
    key: "BEAR",
    label: "Bearish trend day · London high sweep → 5M BOS",
    points: {
      t1900: -4,
      t2200: -18,
      t0000: -32,
      t0200: -50,
      t0400: -60,
      t0600: -70,
      t0700: -74,
      t0800: -78,
      t0830: -80,
      t0900: -82,
      t0915: -84,
      t0930: -86,
      t0938: -28,
      t0943: -38,
      t0948: -88,
      t0952: -84,
      t0954: -80,
      t0956: -84,
      t0958: -102,
      t1000: -112,
      t1004: -116,
      t1020: -130,
      t1200: -225,
      t1400: -205,
      t1600: -185,
      t1700: -180,
    },
  },
  CHOP: {
    key: "CHOP",
    label: "Range day · no directional intent",
    points: {
      t1900: 0,
      t2200: 12,
      t0000: -10,
      t0200: 8,
      t0400: -14,
      t0600: 6,
      t0700: -8,
      t0800: 4,
      t0830: -6,
      t0900: 10,
      t0915: -8,
      t0930: 6,
      t0938: -20,
      t0943: 10,
      t0948: -12,
      t0952: 6,
      t0954: -4,
      t0958: 8,
      t1000: -6,
      t1004: 12,
      t1020: -10,
      t1200: 5,
      t1400: -8,
      t1600: 3,
      t1700: 0,
    },
  },
  CONFLICT_BEAR: {
    key: "CONFLICT_BEAR",
    label: "4H bull / 1H bear · 15M resolution short",
    points: {
      t1900: 2,
      t2200: 10,
      t0000: 18,
      t0200: 25,
      t0400: 30,
      t0600: 35,
      t0700: 20,
      t0800: 15,
      t0830: 5,
      t0900: -25,
      t0915: -28,
      t0930: -30,
      t0938: -20,
      t0943: 5,
      t0947: 45,
      t0951: -30,
      t0954: -55,
      t0958: -20,
      t1002: -35,
      t1004: -95,
      t1020: -130,
      t1200: -290,
      t1400: -250,
      t1600: -210,
      t1700: -200,
    },
  },
  TRAP_BULL: {
    key: "TRAP_BULL",
    label: "Bull trap · sweep + BOS fails at the 09:50 supply",
    points: {
      t1900: 4,
      t2200: 16,
      t0000: 30,
      t0200: 46,
      t0400: 56,
      t0600: 66,
      t0700: 70,
      t0800: 74,
      t0830: 76,
      t0900: 80,
      t0915: 82,
      t0930: 84,
      t0938: 26,
      t0943: 36,
      t0948: 86,
      t0952: 82,
      t0954: 78,
      t0956: 82,
      t0958: 100,
      t1000: 96,
      t1004: 86,
      t1020: 72,
      t1200: 64,
      t1400: 84,
      t1600: 96,
      t1700: 94,
    },
  },
  TRAP_BEAR: {
    key: "TRAP_BEAR",
    label: "Bear trap · sweep + BOS fails at the 09:50 demand",
    points: {
      t1900: -4,
      t2200: -16,
      t0000: -30,
      t0200: -46,
      t0400: -56,
      t0600: -66,
      t0700: -70,
      t0800: -74,
      t0830: -76,
      t0900: -80,
      t0915: -82,
      t0930: -84,
      t0938: -26,
      t0943: -36,
      t0948: -86,
      t0952: -82,
      t0954: -78,
      t0956: -82,
      t0958: -100,
      t1000: -96,
      t1004: -86,
      t1020: -72,
      t1200: -64,
      t1400: -84,
      t1600: -96,
      t1700: -94,
    },
  },
};

const DAY_PLAN: Array<{ day: string; story: StoryKey }> = [
  { day: "2026-10-12", story: "BULL" },
  { day: "2026-10-13", story: "BULL" },
  { day: "2026-10-14", story: "CHOP" },
  { day: "2026-10-15", story: "BULL" },
  { day: "2026-10-16", story: "CONFLICT_BEAR" },
  { day: "2026-10-19", story: "BEAR" },
  { day: "2026-10-20", story: "TRAP_BEAR" },
  { day: "2026-10-21", story: "CHOP" },
  { day: "2026-10-22", story: "BEAR" },
  { day: "2026-10-23", story: "TRAP_BEAR" },
  { day: "2026-10-26", story: "CHOP" },
  { day: "2026-10-27", story: "BULL" },
  { day: "2026-10-28", story: "BULL" },
  { day: "2026-10-29", story: "CONFLICT_BEAR" },
  { day: "2026-10-30", story: "BEAR" },
  { day: "2026-11-02", story: "CHOP" },
  { day: "2026-11-03", story: "BULL" },
  { day: "2026-11-04", story: "BULL" },
  { day: "2026-11-05", story: "TRAP_BULL" },
  { day: "2026-11-06", story: "BULL" },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(1e-9, rng());
  const v = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function roundTick(value: number): number {
  return Math.round(value / 0.25) * 0.25;
}

function interpolate(anchors: Array<{ minute: number; price: number }>, minute: number): number {
  if (minute <= anchors[0].minute) return anchors[0].price;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (minute <= b.minute) {
      const t = (minute - a.minute) / Math.max(1, b.minute - a.minute);
      return a.price + (b.price - a.price) * t;
    }
  }
  return anchors[anchors.length - 1].price;
}

function generateSession(
  dayKey: string,
  startPrice: number,
  story: Story,
  seed: number,
): Candle[] {
  const sessionStart = DateTime.fromISO(dayKey, { zone: NY_ZONE })
    .minus({ days: 1 })
    .set({ hour: 18, minute: 0, second: 0, millisecond: 0 })
    .toSeconds();

  const anchors = (Object.entries(story.points) as Array<[MinuteKey, number]>)
    .map(([key, value]) => ({ minute: MINUTE_OFFSETS[key], price: startPrice + value }))
    .sort((a, b) => a.minute - b.minute);

  // Guarantee both endpoints.
  if (!anchors.some((a) => a.minute === 0)) anchors.unshift({ minute: 0, price: startPrice });
  const last = anchors[anchors.length - 1];
  if (last.minute < 1380) anchors.push({ minute: 1380, price: last.price });

  const rng = mulberry32(seed);
  let previousClose = roundTick(startPrice);
  let residual = 0;
  const candles: Candle[] = [];

  for (let minute = 0; minute < 1380; minute++) {
    const interpolated = interpolate(anchors, minute);
    const minutesIntoNy = minute - 930;
    const newsWindow = minutesIntoNy >= 0 && minutesIntoNy <= 60;
    const noise = newsWindow ? 1.45 : 1.05;

    residual = residual * 0.86 + gaussian(rng) * noise;
    residual = Math.max(-7, Math.min(7, residual));

    const targetClose = roundTick(interpolated + residual);
    const open = previousClose;
    const close = Math.max(1, targetClose);

    const wickScale = newsWindow ? 1.6 : 1.0;
    const upperWick = Math.abs(gaussian(rng)) * noise * 0.85 * wickScale;
    const lowerWick = Math.abs(gaussian(rng)) * noise * 0.85 * wickScale;

    let high = roundTick(Math.max(open, close) + upperWick);
    let low = roundTick(Math.min(open, close) - lowerWick);
    high = Math.max(high, open, close);
    low = Math.min(low, open, close);

    const activityBoost = newsWindow ? 2.6 : minute < 60 ? 1.5 : 1;
    const volume = Math.round((450 + rng() * 750 + Math.abs(close - open) * 45) * activityBoost);

    candles.push({
      time: Math.floor(sessionStart + minute * 60),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    previousClose = close;
  }

  return candles;
}

export interface GeneratedDataset {
  candles: Candle[];
  start: number;
  end: number;
  seed: number;
  stories: Array<{ day: string; story: StoryKey; label: string; startPrice: number }>;
}

export function generateSampleDataset(seed = 20261106): GeneratedDataset {
  const candles: Candle[] = [];
  let price = 18240;
  const stories: GeneratedDataset["stories"] = [];

  for (let index = 0; index < DAY_PLAN.length; index++) {
    const { day, story } = DAY_PLAN[index];
    const definition = STORIES[story];
    const session = generateSession(day, price, definition, seed + index * 7919);
    if (session.length) price = session[session.length - 1].close;
    candles.push(...session);
    stories.push({
      day,
      story,
      label: definition.label,
      startPrice: session[0]?.open ?? price,
    });
  }

  return {
    candles,
    start: candles[0]?.time ?? 0,
    end: candles[candles.length - 1]?.time ?? 0,
    seed,
    stories,
  };
}

export const SAMPLE_STORIES = STORIES;
export const SAMPLE_DAY_PLAN = DAY_PLAN;
