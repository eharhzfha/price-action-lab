"use client";

import { create } from "zustand";
import { analyzeStrategy, resolveConfig } from "@/lib/engine/strategy";
import { atNyTime, observationWindow, tradingDayKey } from "@/lib/engine/time";
import {
  DEFAULT_ENGINE_CONFIG,
  type Candle,
  type EngineConfig,
  type Timeframe,
} from "@/lib/engine/types";

export type TabKey = "dashboard" | "charts" | "engine" | "backtest" | "paper" | "risk" | "journal";
export type PlaybackSpeed = 1 | 2 | 5 | 20 | 60;

export interface AppSettings {
  defaultInstrument: "NQ" | "MNQ";
  accountSize: number;
  riskPct: number;
  commissionPerSide: number;
  slippageTicks: number;
  observationStart: string;
  observationEnd: string;
  defaultRR: number;
  timezone: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultInstrument: "MNQ",
  accountSize: 100000,
  riskPct: 1,
  commissionPerSide: 2.5,
  slippageTicks: 1,
  observationStart: "09:50",
  observationEnd: "10:10",
  defaultRR: 2,
  timezone: "America/New_York",
};

export interface OverlayState {
  fvg: boolean;
  orderBlocks: boolean;
  liquidity: boolean;
  structure: boolean;
  equilibrium: boolean;
  signal: boolean;
}

interface AppState {
  tab: TabKey;
  setTab: (tab: TabKey) => void;

  candles: Candle[];
  datasetName: string;
  dataSource: string;
  dataWarnings: string[];
  dataLoading: boolean;
  dataError: string | null;
  loadDataset: (candles: Candle[], name: string, source: string, warnings?: string[]) => void;
  setDataLoading: (loading: boolean) => void;
  setDataError: (error: string | null) => void;

  dayKey: string;
  days: string[];
  cursor: number;
  setCursor: (time: number) => void;
  setDay: (day: string) => void;
  step: (minutes: number) => void;
  tick: () => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;
  speedMs: number;

  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;
  overlays: OverlayState;
  toggleOverlay: (key: keyof OverlayState) => void;

  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;

  engineConfig: EngineConfig;
  setEngineConfig: (config: Partial<EngineConfig>) => void;
  resetEngineConfig: () => void;

  mode: "REPLAY" | "SIM";
  setMode: (mode: "REPLAY" | "SIM") => void;

  featuredSignalTime: number | null;
  setFeaturedSignalTime: (time: number | null) => void;
}

const SPEED_MS: Record<PlaybackSpeed, number> = { 1: 900, 2: 450, 5: 180, 20: 50, 60: 16 };

function uniqueDays(candles: Candle[]): string[] {
  const set = new Set<string>();
  for (const candle of candles) set.add(tradingDayKey(candle.time));
  return Array.from(set).sort();
}

function findSessionCursor(candles: Candle[], day: string, config: EngineConfig): number {
  const { start, end } = observationWindow(day, config);
  let cursor = atNyTime(day, "09:50");
  let found: number | null = null;

  for (let t = start; t <= end; t += 60) {
    const analysis = analyzeStrategy(candles, config, t);
    if (analysis.setup.signal) {
      cursor = t;
      found = t;
    }
  }
  return found ?? cursor;
}

export const useAppStore = create<AppState>((set, get) => ({
  tab: "dashboard",
  setTab: (tab) => set({ tab }),

  candles: [],
  datasetName: "—",
  dataSource: "—",
  dataWarnings: [],
  dataLoading: true,
  dataError: null,

  loadDataset: (candles, name, source, warnings = []) => {
    const days = uniqueDays(candles);
    const dayKey = days[days.length - 1] ?? "";
    const config = get().engineConfig;
    const featured = candles.length ? findSessionCursor(candles, dayKey, config) : null;

    set({
      candles,
      datasetName: name,
      dataSource: source,
      dataWarnings: warnings,
      dataLoading: false,
      dataError: null,
      days,
      dayKey,
      cursor: featured ?? atNyTime(dayKey, "10:00"),
      featuredSignalTime: featured,
      playing: false,
    });
  },

  setDataLoading: (dataLoading) => set({ dataLoading }),
  setDataError: (dataError) => set({ dataError, dataLoading: false }),

  dayKey: "",
  days: [],
  cursor: 0,
  setCursor: (cursor) => {
    const { dayKey } = get();
    const start = atNyTime(dayKey, "09:30");
    const end = atNyTime(dayKey, "16:00");
    set({ cursor: Math.max(start, Math.min(end, cursor)), playing: false });
  },
  setDay: (day) => {
    const { candles, engineConfig } = get();
    const start = atNyTime(day, "09:30");
    const end = atNyTime(day, "16:00");
    const current = get().cursor;
    const keep = current >= start && current <= end;
    const featured = day === uniqueDays(candles).slice(-1)[0] ? findSessionCursor(candles, day, engineConfig) : null;
    set({
      dayKey: day,
      cursor: keep ? current : featured ?? atNyTime(day, "09:50"),
      playing: false,
    });
  },
  step: (minutes) => {
    const { cursor, dayKey } = get();
    const start = atNyTime(dayKey, "09:30");
    const end = atNyTime(dayKey, "16:00");
    const next = Math.max(start, Math.min(end, cursor + minutes * 60));
    set({ cursor: next, playing: next >= end ? false : get().playing });
  },
  tick: () => {
    const { cursor, dayKey, playing } = get();
    const end = atNyTime(dayKey, "16:00");
    if (!playing) return;
    if (cursor >= end) {
      set({ playing: false });
      return;
    }
    set({ cursor: Math.min(end, cursor + 60) });
  },
  playing: false,
  setPlaying: (playing) => {
    const { cursor, dayKey } = get();
    if (playing && cursor >= atNyTime(dayKey, "16:00")) {
      set({ cursor: atNyTime(dayKey, "09:30"), playing: true });
      return;
    }
    set({ playing });
  },
  speed: 5,
  setSpeed: (speed) => set({ speed, speedMs: SPEED_MS[speed] }),
  speedMs: SPEED_MS[5],

  timeframe: "1M",
  setTimeframe: (timeframe) => set({ timeframe }),
  overlays: { fvg: true, orderBlocks: true, liquidity: true, structure: true, equilibrium: true, signal: true },
  toggleOverlay: (key) =>
    set((state) => ({ overlays: { ...state.overlays, [key]: !state.overlays[key] } })),

  settings: DEFAULT_SETTINGS,
  setSettings: (partial) =>
    set((state) => {
      const settings = { ...state.settings, ...partial };
      return {
        settings,
        engineConfig: {
          ...state.engineConfig,
          observationStart: settings.observationStart,
          observationEnd: settings.observationEnd,
          rr: settings.defaultRR,
        },
      };
    }),

  engineConfig: resolveConfig({
    observationStart: DEFAULT_SETTINGS.observationStart,
    observationEnd: DEFAULT_SETTINGS.observationEnd,
    rr: DEFAULT_SETTINGS.defaultRR,
  }),
  setEngineConfig: (config) => set((state) => ({ engineConfig: resolveConfig({ ...state.engineConfig, ...config }) })),
  resetEngineConfig: () =>
    set((state) => ({
      engineConfig: resolveConfig({
        observationStart: state.settings.observationStart,
        observationEnd: state.settings.observationEnd,
        rr: state.settings.defaultRR,
      }),
    })),

  mode: "REPLAY",
  setMode: (mode) => set({ mode }),

  featuredSignalTime: null,
  setFeaturedSignalTime: (featuredSignalTime) => set({ featuredSignalTime }),
}));
