/**
 * PRICE ACTION LAB — strategy engine domain model.
 * This module is framework-free and deterministic so it can be unit tested
 * and reused by the UI, the backtester and the paper trader.
 */

export type Timeframe = "1M" | "5M" | "15M" | "1H" | "4H";
export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
export type TradeDirection = "LONG" | "SHORT";
export type Instrument = "NQ" | "MNQ";
export type CheckStatus = "PASS" | "FAIL" | "WAIT" | "INFO";
export type SetupState =
  | "NO_SETUP"
  | "CONTEXT_UNCLEAR"
  | "AWAITING_SWEEP"
  | "AWAITING_CONFLUENCE"
  | "AWAITING_ENTRY"
  | "TRIGGERED";

export interface Candle {
  /** Unix timestamp in seconds (UTC). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  kind: "HIGH" | "LOW";
  /** Candle index at which this pivot became knowable (index + lookback). */
  confirmedIndex: number;
}

export type StructureEventKind = "BOS" | "CHOCH";

export interface StructureEvent {
  kind: StructureEventKind;
  direction: Direction;
  time: number;
  price: number;
  level: number;
  index: number;
}

export interface StructureAnalysis {
  timeframe: Timeframe;
  direction: Direction;
  swings: SwingPoint[];
  events: StructureEvent[];
  lastEvent: StructureEvent | null;
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
  rangeHigh: number;
  rangeLow: number;
  equilibrium: number;
  bars: number;
  lookback: number;
}

export type LiquidityKind =
  | "PDH"
  | "PDL"
  | "ASIA_HIGH"
  | "ASIA_LOW"
  | "LONDON_HIGH"
  | "LONDON_LOW"
  | "NY_OPEN_HIGH"
  | "NY_OPEN_LOW"
  | "EQH"
  | "EQL";

export interface LiquidityLevel {
  key: string;
  label: string;
  kind: LiquidityKind;
  price: number;
  side: "BUY_SIDE" | "SELL_SIDE";
  /** Distance from current price in points (signed: positive = above). */
  distance: number;
  touches?: number;
  /** Time at which the level became valid (used to prevent look-ahead). */
  formedAt?: number;
}

export type LiquiditySide = "BUY_SIDE" | "SELL_SIDE";

export interface LiquiditySweep {
  id: string;
  level: LiquidityLevel;
  side: LiquiditySide;
  time: number;
  sweepPrice: number;
  levelPrice: number;
  penetration: number;
  /** Direction the sweep implies for a reversal trade. */
  implication: TradeDirection;
  candlesAgo: number;
}

export type ZoneKind = "FVG" | "OB" | "BREAKER";

export interface Zone {
  id: string;
  kind: ZoneKind;
  direction: TradeDirection;
  top: number;
  bottom: number;
  midpoint: number;
  startTime: number;
  endTime: number | null;
  /** True when price traded back into the zone (a valid POI tap). */
  tapped: boolean;
  lastTapTime: number | null;
  /** True when price closed through the far edge and the zone lost validity. */
  invalidated: boolean;
  strength: number;
}

export interface EquilibriumState {
  rangeHigh: number;
  rangeLow: number;
  equilibrium: number;
  price: number;
  location: "PREMIUM" | "DISCOUNT" | "AT_EQUILIBRIUM";
  inDiscount: boolean;
  inPremium: boolean;
  /** SWEEP_LEG = post-liquidity displacement leg; 1H_RANGE = fallback. */
  source: "SWEEP_LEG" | "1H_RANGE";
}

export interface EngineConfig {
  observationStart: string; // HH:mm in New York time
  observationEnd: string;
  timezone: string;
  rr: number;
  sweepLookbackMinutes: number;
  zoneLookbackMinutes: number;
  bosFreshnessMinutes: number;
  entryBosFreshnessMinutes: number;
  historyDays: number;
  equalTolerancePoints: number;
  zoneTolerancePoints: number;
  minGapPoints: number;
  entryBufferPoints: number;
  requireHtfBos: boolean;
  requireEquilibrium: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  critical: boolean;
}

export interface StrategySignal {
  direction: TradeDirection;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  riskPoints: number;
  triggerTime: number;
  sweepTime: number;
  tapTime: number;
  grade: "A+" | "A" | "B" | "C";
  score: number;
  confluences: string[];
  reasons: string[];
  zone: Zone;
  sweep: LiquiditySweep;
  bosTimeframe: "5M" | "15M";
  equilibrium: EquilibriumState;
}

export interface HtfBias {
  timeframe: "4H" | "1H";
  direction: Direction;
  structure: StructureAnalysis;
}

export interface StrategyAnalysis {
  asOf: number;
  price: number;
  tradingDay: string;
  inWindow: boolean;
  windowLabel: string;
  htf: {
    bias4h: HtfBias;
    bias1h: HtfBias;
    aligned: boolean;
    conflicted: boolean;
    unclear: boolean;
    selectedBosTimeframe: "5M" | "15M" | null;
    contextLabel: string;
    structure5m: StructureAnalysis;
    structure15m: StructureAnalysis;
    directionalBos: StructureEvent | null;
  };
  liquidity: {
    levels: LiquidityLevel[];
    sweeps: LiquiditySweep[];
    activeSweep: LiquiditySweep | null;
    eqh: LiquidityLevel[];
    eql: LiquidityLevel[];
    pdh: number | null;
    pdl: number | null;
  };
  confluences: {
    fvgs: Zone[];
    orderBlocks: Zone[];
    breakers: Zone[];
    activeZone: Zone | null;
    zoneTappedRecently: boolean;
    equilibrium: EquilibriumState;
    equilibriumOk: boolean;
    count: number;
    labels: string[];
  };
  trigger: {
    bos1m: StructureEvent | null;
    structure1m: StructureAnalysis;
    direction: TradeDirection | null;
    confirmed: boolean;
    freshnessOk: boolean;
  };
  checklist: ChecklistItem[];
  setup: {
    state: SetupState;
    decision: "LONG" | "SHORT" | "NO TRADE";
    grade: "A+" | "A" | "B" | "C" | null;
    reason: string;
    signal: StrategySignal | null;
  };
  meta: {
    barsUsed: number;
    evaluatedAt: string;
    lookAhead: false;
    engineVersion: string;
  };
}

export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  "1M": 1,
  "5M": 5,
  "15M": 15,
  "1H": 60,
  "4H": 240,
};

export const INSTRUMENTS = {
  NQ: {
    code: "NQ",
    symbol: "NQ1!",
    name: "E-mini Nasdaq-100",
    pointValue: 20,
    tickSize: 0.25,
    tickValue: 5,
    estMargin: 22000,
  },
  MNQ: {
    code: "MNQ",
    symbol: "MNQ1!",
    name: "Micro E-mini Nasdaq-100",
    pointValue: 2,
    tickSize: 0.25,
    tickValue: 0.5,
    estMargin: 2200,
  },
} as const;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  observationStart: "09:50",
  observationEnd: "10:10",
  timezone: "America/New_York",
  rr: 2,
  sweepLookbackMinutes: 90,
  zoneLookbackMinutes: 180,
  bosFreshnessMinutes: 240,
  entryBosFreshnessMinutes: 12,
  historyDays: 3,
  equalTolerancePoints: 2,
  zoneTolerancePoints: 0.5,
  minGapPoints: 0.25,
  entryBufferPoints: 1.5,
  requireHtfBos: true,
  requireEquilibrium: false,
};

export const SETUP_STATE_LABEL: Record<SetupState, string> = {
  NO_SETUP: "No setup",
  CONTEXT_UNCLEAR: "Context unclear",
  AWAITING_SWEEP: "Awaiting liquidity sweep",
  AWAITING_CONFLUENCE: "Awaiting confluence",
  AWAITING_ENTRY: "Awaiting entry trigger",
  TRIGGERED: "Setup triggered",
};
