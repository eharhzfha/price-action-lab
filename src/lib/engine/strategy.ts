import {
  aggregateCandles,
  analyzeStructure,
  findPivots,
} from "./candles";
import { detectFvgs, detectOrderBlocks, computeEquilibrium, findRecentZoneTap } from "./confluence";
import type { ZoneTap } from "./confluence";
import {
  activeSweepFor,
  computeLiquidityLevels,
  detectLiquiditySweeps,
} from "./liquidity";
import {
  isInObservationWindow,
  observationWindow,
  toNyTime,
  tradingDayKey,
  windowLabel,
  minutesToHHMM,
  hhmmToMinutes,
  nyMinuteOfDay,
} from "./time";
import {
  DEFAULT_ENGINE_CONFIG,
  SETUP_STATE_LABEL,
  type Candle,
  type CheckStatus,
  type ChecklistItem,
  type Direction,
  type EngineConfig,
  type EquilibriumState,
  type LiquiditySweep,
  type StrategyAnalysis,
  type StrategySignal,
  type TradeDirection,
  type Zone,
} from "./types";

export const ENGINE_VERSION = "1.0.0";

export function resolveConfig(input?: Partial<EngineConfig>): EngineConfig {
  return { ...DEFAULT_ENGINE_CONFIG, ...(input ?? {}) };
}

function ageLabel(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function directionFor(analysis: StrategyAnalysis): TradeDirection | null {
  const dir = analysis.htf.aligned
    ? analysis.htf.bias4h.direction
    : analysis.htf.conflicted
      ? analysis.htf.structure15m.lastEvent?.direction
      : null;
  if (dir === "BULLISH") return "LONG";
  if (dir === "BEARISH") return "SHORT";
  return null;
}

function emptyAnalysis(asOf: number, config: EngineConfig, reason: string): StrategyAnalysis {
  const structure = analyzeStructure([], "1M", 2, 60);
  const htf = (tf: "4H" | "1H") => ({
    timeframe: tf,
    direction: "NEUTRAL" as Direction,
    structure: analyzeStructure([], tf, 2, 24),
  });
  return {
    asOf,
    price: 0,
    tradingDay: tradingDayKey(asOf),
    inWindow: false,
    windowLabel: windowLabel(config),
    htf: {
      bias4h: htf("4H"),
      bias1h: htf("1H"),
      aligned: false,
      conflicted: false,
      unclear: true,
      selectedBosTimeframe: null,
      contextLabel: "No data",
      structure5m: analyzeStructure([], "5M", 3, 48),
      structure15m: analyzeStructure([], "15M", 3, 32),
      directionalBos: null,
    },
    liquidity: { levels: [], sweeps: [], activeSweep: null, eqh: [], eql: [], pdh: null, pdl: null },
    confluences: {
      fvgs: [],
      orderBlocks: [],
      breakers: [],
      activeZone: null,
      zoneTappedRecently: false,
      equilibrium: {
        rangeHigh: 0,
        rangeLow: 0,
        equilibrium: 0,
        price: 0,
        location: "AT_EQUILIBRIUM",
        inDiscount: false,
        inPremium: false,
        source: "1H_RANGE",
      },
      equilibriumOk: false,
      count: 0,
      labels: [],
    },
    trigger: { bos1m: null, structure1m: structure, direction: null, confirmed: false, freshnessOk: false },
    checklist: [
      {
        id: "data",
        label: "Market data available",
        status: "FAIL",
        detail: reason,
        critical: true,
      },
    ],
    setup: {
      state: "NO_SETUP",
      decision: "NO TRADE",
      grade: null,
      reason,
      signal: null,
    },
    meta: {
      barsUsed: 0,
      evaluatedAt: new Date().toISOString(),
      lookAhead: false,
      engineVersion: ENGINE_VERSION,
    },
  };
}

function gradeFor(score: number): StrategySignal["grade"] {
  if (score >= 88) return "A+";
  if (score >= 78) return "A";
  if (score >= 66) return "B";
  return "C";
}

/**
 * Evaluate the full methodology at a single point in time.
 *
 * IMPORTANT: every structure is derived from candles where `time <= asOf`.
 * The function never reads a future candle; this is what makes the backtest
 * honest and the live/replay UI consistent with the backtest.
 */
export function analyzeStrategy(
  source: Candle[],
  configInput?: Partial<EngineConfig>,
  asOfInput?: number,
): StrategyAnalysis {
  const config = resolveConfig(configInput);
  const sorted = source.length <= 1 ? source : [...source].sort((a, b) => a.time - b.time);
  const asOf = asOfInput ?? sorted[sorted.length - 1]?.time ?? 0;

  if (!sorted.length) return emptyAnalysis(asOf, config, "No candles available for evaluation.");

  const cutoff = asOf - config.historyDays * 86400;
  const candles = sorted.filter((c) => c.time <= asOf && c.time >= cutoff);
  if (!candles.length) return emptyAnalysis(asOf, config, "No candles available at this replay cursor.");

  const price = candles[candles.length - 1].close;
  const day = tradingDayKey(asOf);

  // ---- Step 1: higher timeframe structure ---------------------------------
  // HTF bias uses *closed* candles only. An unfinished 4H/1H bar must never
  // flip the bias intra-hour (and would be repainting in a replay/backtest).
  const closed4h = aggregateCandles(candles, "4H").filter((b) => b.time + 240 * 60 <= asOf);
  const closed1h = aggregateCandles(candles, "1H").filter((b) => b.time + 60 * 60 <= asOf);
  const structure4h = analyzeStructure(closed4h, "4H", 2, 30);
  const structure1h = analyzeStructure(closed1h, "1H", 2, 24);
  const structure5m = analyzeStructure(aggregateCandles(candles, "5M"), "5M", 3, 48);
  const structure15m = analyzeStructure(aggregateCandles(candles, "15M"), "15M", 3, 32);
  const structure1m = analyzeStructure(candles, "1M", 2, 60);

  const bias4h = structure4h.direction;
  const bias1h = structure1h.direction;
  const aligned = bias4h !== "NEUTRAL" && bias4h === bias1h;
  const conflicted = bias4h !== "NEUTRAL" && bias1h !== "NEUTRAL" && bias4h !== bias1h;
  const unclear = bias4h === "NEUTRAL" || bias1h === "NEUTRAL";
  const selectedBosTimeframe = aligned ? "5M" : conflicted ? "15M" : null;
  const selectedStructure = selectedBosTimeframe === "5M" ? structure5m : selectedBosTimeframe === "15M" ? structure15m : null;
  const directionalBos = selectedStructure?.lastEvent ?? null;
  const directionalFresh = directionalBos ? asOf - directionalBos.time <= config.bosFreshnessMinutes * 60 : false;

  const contextLabel = unclear
    ? "UNCLEAR · HTF structure unresolved"
    : aligned
      ? `ALIGNED ${bias4h} · 4H + 1H → 5M BOS`
      : `CONFLICT · 4H ${bias4h} / 1H ${bias1h} → 15M BOS`;

  const provisionalDirection: TradeDirection | null = aligned
    ? bias4h === "BULLISH"
      ? "LONG"
      : "SHORT"
    : conflicted
      ? structure15m.lastEvent?.direction === "BULLISH"
        ? "LONG"
        : structure15m.lastEvent?.direction === "BEARISH"
          ? "SHORT"
          : null
      : null;

  // ---- Step 2/3: liquidity and confluences --------------------------------
  const liquidity = computeLiquidityLevels(
    candles,
    asOf,
    structure5m,
    config.equalTolerancePoints,
  );
  const sweeps = detectLiquiditySweeps(
    candles,
    asOf,
    liquidity.levels,
    config.sweepLookbackMinutes,
  );
  const activeSweep = provisionalDirection ? activeSweepFor(sweeps, provisionalDirection) : null;

  const fvgs = detectFvgs(candles, asOf, config.zoneLookbackMinutes, config.minGapPoints, config.zoneTolerancePoints);
  const { orderBlocks, breakers } = detectOrderBlocks(
    candles,
    structure1m,
    asOf,
    config.zoneLookbackMinutes,
  );
  const allZones: Zone[] = [...orderBlocks, ...breakers, ...fvgs];
  const baseEquilibrium = computeEquilibrium(structure1h, price);
  const sweepLeg = activeSweep
    ? candles.filter((c) => c.time >= activeSweep.time && c.time <= asOf)
    : [];
  let equilibrium: EquilibriumState = baseEquilibrium;
  if (sweepLeg.length >= 3) {
    const legHigh = Math.max(...sweepLeg.map((c) => c.high));
    const legLow = Math.min(...sweepLeg.map((c) => c.low));
    const legEq = (legHigh + legLow) / 2;
    equilibrium = {
      rangeHigh: legHigh,
      rangeLow: legLow,
      equilibrium: legEq,
      price,
      location: price > legEq ? "PREMIUM" : price < legEq ? "DISCOUNT" : "AT_EQUILIBRIUM",
      inDiscount: price < legEq,
      inPremium: price > legEq,
      source: "SWEEP_LEG",
    };
  }
  const zoneTap: ZoneTap | null = provisionalDirection
    ? findRecentZoneTap(allZones, provisionalDirection, asOf, activeSweep?.time ?? 0, price, {
        freshnessMinutes: 20,
        tolerance: config.zoneTolerancePoints,
      })
    : null;

  const equilibriumOk = provisionalDirection
    ? provisionalDirection === "LONG"
      ? (zoneTap?.zone.midpoint ?? price) <= equilibrium.equilibrium
      : (zoneTap?.zone.midpoint ?? price) >= equilibrium.equilibrium
    : false;

  // ---- Step 4: 1M entry confirmation --------------------------------------
  const triggerCutoff = asOf - config.entryBosFreshnessMinutes * 60;
  const last1m = structure1m.lastEvent;
  const expectedDirection: Direction | null =
    provisionalDirection === "LONG" ? "BULLISH" : provisionalDirection === "SHORT" ? "BEARISH" : null;
  const triggerBos =
    last1m &&
    expectedDirection &&
    last1m.direction === expectedDirection &&
    (!zoneTap || last1m.time >= zoneTap.tapTime) &&
    last1m.time >= triggerCutoff
      ? last1m
      : null;

  const inWindow = isInObservationWindow(asOf, config);
  const window = observationWindow(day, config);
  const minute = nyMinuteOfDay(asOf);

  const directionalBosMatches =
    !!directionalBos &&
    !!expectedDirection &&
    directionalBos.direction === expectedDirection &&
    directionalFresh &&
    !!selectedBosTimeframe;

  const sweepOk = !!activeSweep;

  const zoneOk = !!zoneTap && (!config.requireEquilibrium || equilibriumOk);
  const triggerOk = !!triggerBos;
  const riskOk = !!zoneTap && !!activeSweep;

  // ---- Step 5: checklist ---------------------------------------------------
  const checklist: ChecklistItem[] = [];

  const htfStatus = (dir: Direction, tf: "4H" | "1H") => {
    if (dir === "NEUTRAL") {
      return {
        status: "FAIL" as CheckStatus,
        detail: `${tf} structure unresolved — no confirmed BOS or CHoCH.`,
      };
    }
    return {
      status: "PASS" as CheckStatus,
      detail: `${tf} structure ${dir.toLowerCase()} · last ${tf} event ${toNyTime(
        tf === "4H" ? structure4h.lastEvent?.time ?? asOf : structure1h.lastEvent?.time ?? asOf,
      )} ET.`,
    };
  };

  const s4h = htfStatus(bias4h, "4H");
  checklist.push({
    id: "htf-4h",
    label: "4H market structure",
    status: s4h.status,
    detail: s4h.detail,
    critical: true,
  });

  const s1h = htfStatus(bias1h, "1H");
  checklist.push({
    id: "htf-1h",
    label: "1H market structure",
    status: s1h.status,
    detail: s1h.detail,
    critical: true,
  });

  checklist.push({
    id: "bias-alignment",
    label: "HTF alignment & BOS timeframe",
    status: aligned ? "PASS" : conflicted ? (provisionalDirection ? "PASS" : "WAIT") : "FAIL",
    detail: aligned
      ? `4H and 1H agree (${bias4h.toLowerCase()}). BOS timeframe = 5M.`
      : conflicted
        ? provisionalDirection
          ? `Conflict resolved by 15M ${structure15m.lastEvent?.direction.toLowerCase()} BOS. BOS timeframe = 15M.`
          : "4H and 1H conflict; waiting for a 15M BOS to resolve direction."
        : "Unclear HTF context. No BOS timeframe can be selected.",
    critical: true,
  });

  checklist.push({
    id: "directional-bos",
    label: `${selectedBosTimeframe ?? "—"} directional BOS`,
    status: directionalBosMatches ? "PASS" : selectedBosTimeframe ? "FAIL" : "WAIT",
    detail: !selectedBosTimeframe
      ? "BOS timeframe not selected yet."
      : !directionalBos
        ? `${selectedBosTimeframe} has no confirmed BOS.`
        : `${selectedBosTimeframe} last event: ${directionalBos.kind} ${directionalBos.direction.toLowerCase()} @ ${directionalBos.level.toFixed(2)} (${ageLabel(
            asOf - directionalBos.time,
          )}).${directionalFresh ? "" : " Stale — outside freshness window."}`,
    critical: true,
  });

  checklist.push({
    id: "liquidity-sweep",
    label: "Liquidity sweep",
    status: sweepOk ? "PASS" : provisionalDirection ? "WAIT" : "WAIT",
    detail: activeSweep
      ? `${activeSweep.level.label} swept by ${activeSweep.penetration.toFixed(2)} pts at ${toNyTime(
          activeSweep.time,
        )} ET (${ageLabel(asOf - activeSweep.time)}).`
      : provisionalDirection
        ? `No ${provisionalDirection === "LONG" ? "sell-side" : "buy-side"} sweep in the last ${config.sweepLookbackMinutes}m.`
        : "Direction unresolved — cannot evaluate liquidity.",
    critical: true,
  });

  let zoneStatus: CheckStatus = "WAIT";
  let zoneDetail = "No directionally aligned POI tap yet.";
  if (zoneTap) {
    zoneDetail = `${zoneTap.zone.kind === "OB" ? "Order block" : zoneTap.zone.kind === "FVG" ? "Fair value gap" : "Breaker"} (${zoneTap.zone.direction.toLowerCase()}) tapped ${ageLabel(
      asOf - zoneTap.tapTime,
    )} at ${zoneTap.zone.bottom.toFixed(2)}–${zoneTap.zone.top.toFixed(2)}.`;
    zoneStatus = zoneOk ? "PASS" : "WAIT";
    if (!config.requireEquilibrium && !equilibriumOk) zoneStatus = "PASS";
  }
  checklist.push({
    id: "confluence-zone",
    label: "FVG / OB / breaker tap",
    status: zoneStatus,
    detail: zoneDetail,
    critical: true,
  });

  checklist.push({
    id: "equilibrium",
    label: "Equilibrium (premium / discount)",
    status: equilibriumOk ? "PASS" : config.requireEquilibrium ? "FAIL" : "INFO",
    detail: (zoneTap
      ? `POI midpoint ${zoneTap.zone.midpoint.toFixed(2)} vs ${equilibrium.source === "SWEEP_LEG" ? "displacement-leg" : "1H"} equilibrium ${equilibrium.equilibrium.toFixed(2)} · ${
          equilibriumOk ? "correct side" : "wrong side"
        }.`
      : `${equilibrium.source === "SWEEP_LEG" ? "Displacement leg" : "1H dealing range"} ${equilibrium.rangeLow.toFixed(2)} – ${equilibrium.rangeHigh.toFixed(2)} · EQ ${equilibrium.equilibrium.toFixed(2)}.`) +
      (config.requireEquilibrium ? " Blocking gate." : " Confluence only (non-blocking)."),
    critical: config.requireEquilibrium,
  });

  checklist.push({
    id: "entry-trigger",
    label: "1M BOS entry confirmation",
    status: triggerOk ? "PASS" : zoneTap ? "WAIT" : "WAIT",
    detail: triggerBos
      ? `1M BOS ${triggerBos.direction.toLowerCase()} at ${toNyTime(triggerBos.time)} ET, ${ageLabel(
          asOf - triggerBos.time,
        )}.`
      : last1m && expectedDirection && last1m.direction !== expectedDirection
        ? `Last 1M event is ${last1m.direction.toLowerCase()} — confirmation must follow the tap.`
        : zoneTap
          ? `Waiting for a fresh 1M BOS after the ${toNyTime(zoneTap.tapTime)} ET tap (max ${config.entryBosFreshnessMinutes}m).`
          : "Waiting for a POI tap before the entry trigger.",
    critical: true,
  });

  let windowStatus: CheckStatus = "WAIT";
  let windowDetail = `Observation window ${config.observationStart}–${config.observationEnd} ET.`;
  if (inWindow) {
    windowStatus = "PASS";
    windowDetail = `Inside observation window · ${toNyTime(asOf)} ET.`;
  } else if (asOf < window.start) {
    windowStatus = "WAIT";
    windowDetail = `Window opens at ${config.observationStart} ET (${Math.ceil((window.start - asOf) / 60)}m).`;
  } else {
    windowStatus = "FAIL";
    windowDetail = `Window closed at ${config.observationEnd} ET.`;
  }
  checklist.push({
    id: "observation-window",
    label: "Observation window",
    status: windowStatus,
    detail: windowDetail,
    critical: true,
  });

  const riskPointsEstimate =
    zoneTap && activeSweep
      ? Math.abs(
          price -
            (provisionalDirection === "LONG"
              ? Math.min(activeSweep.sweepPrice, zoneTap.zone.bottom) - config.entryBufferPoints
              : Math.max(activeSweep.sweepPrice, zoneTap.zone.top) + config.entryBufferPoints),
        )
      : 0;
  checklist.push({
    id: "risk-model",
    label: "Risk model & R:R",
    status: riskPointsEstimate > 0.5 ? "PASS" : "INFO",
    detail:
      riskPointsEstimate > 0.5
        ? `Structural stop ${riskPointsEstimate.toFixed(2)} pts · ${config.rr.toFixed(1)}R target model.`
        : "Stop and target are derived from the sweep extreme and POI once a trigger is confirmed.",
    critical: false,
  });

  const corePass =
    !unclear &&
    !!provisionalDirection &&
    directionalBosMatches &&
    sweepOk &&
    zoneOk &&
    triggerOk &&
    inWindow &&
    (!config.requireEquilibrium || equilibriumOk);

  // ---- Step 6: state machine & signal -------------------------------------
  let state: StrategyAnalysis["setup"]["state"] = "NO_SETUP";
  let reason = "No qualifying setup.";

  if (unclear) {
    state = "CONTEXT_UNCLEAR";
    reason = "Higher timeframe context is unclear. Stand aside until 4H and 1H structure resolve.";
  } else if (!provisionalDirection) {
    state = "NO_SETUP";
    reason = "4H/1H conflict with no 15M resolution. Waiting for the 15M BOS to set direction.";
  } else if (!directionalBosMatches) {
    state = "AWAITING_CONFLUENCE";
    reason = `${selectedBosTimeframe ?? "BOS"} structure has not confirmed the ${provisionalDirection.toLowerCase()} bias yet.`;
  } else if (!sweepOk) {
    state = "AWAITING_SWEEP";
    reason = `HTF bias is ${provisionalDirection === "LONG" ? "bullish" : "bearish"}. Waiting for ${
      provisionalDirection === "LONG" ? "sell-side" : "buy-side"
    } liquidity to be swept.`;
  } else if (!zoneOk) {
    state = "AWAITING_CONFLUENCE";
    reason = "Liquidity has been swept. Waiting for price to tap a valid FVG / order block in the correct equilibrium zone.";
  } else if (!triggerOk) {
    state = "AWAITING_ENTRY";
    reason = "Liquidity + POI confluence are valid. Waiting for the 1M BOS entry confirmation inside the observation window.";
  } else if (!inWindow) {
    state = "AWAITING_ENTRY";
    reason = "Entry confirmation fired outside the observation window; no trade is taken.";
  } else if (corePass) {
    state = "TRIGGERED";
    reason = "All methodology gates passed. Entry trigger is valid.";
  }

  let signal: StrategySignal | null = null;

  if (state === "TRIGGERED" && provisionalDirection && activeSweep && zoneTap && triggerBos) {
    const tapWindow = candles.filter(
      (c) => c.time >= zoneTap.tapTime - 2 * 60 && c.time <= triggerBos.time,
    );
    const tapLow = tapWindow.length ? Math.min(...tapWindow.map((c) => c.low)) : zoneTap.zone.bottom;
    const tapHigh = tapWindow.length ? Math.max(...tapWindow.map((c) => c.high)) : zoneTap.zone.top;

    let stop: number;
    let risk: number;
    if (provisionalDirection === "LONG") {
      const rawStop = Math.min(zoneTap.zone.bottom, tapLow) - config.entryBufferPoints;
      stop = Math.min(rawStop, price - 0.5);
      risk = price - stop;
    } else {
      const rawStop = Math.max(zoneTap.zone.top, tapHigh) + config.entryBufferPoints;
      stop = Math.max(rawStop, price + 0.5);
      risk = stop - price;
    }

    if (risk > 0.5) {
      const target = provisionalDirection === "LONG" ? price + risk * config.rr : price - risk * config.rr;
      const alignedBonus = aligned ? 10 : 6;
      const sweepBonus =
        activeSweep.level.kind === "PDH" || activeSweep.level.kind === "PDL"
          ? 16
          : activeSweep.level.kind === "EQH" || activeSweep.level.kind === "EQL"
            ? 12
            : 8;
      const zoneBonus = zoneTap.zone.kind === "OB" ? 12 : zoneTap.zone.kind === "BREAKER" ? 10 : 7;
      const breakerBonus = breakers.some((b) => b.direction === provisionalDirection) ? 6 : 0;
      const freshnessBonus = asOf - triggerBos.time <= 180 ? 5 : 1;
      const eqBonus = equilibriumOk ? 6 : 0;
      const score = Math.min(99, 55 + alignedBonus + sweepBonus + zoneBonus + breakerBonus + freshnessBonus + eqBonus);

      const confluences: string[] = [
        `${activeSweep.side === "SELL_SIDE" ? "Sell-side" : "Buy-side"} sweep · ${activeSweep.level.label}`,
        `${zoneTap.zone.kind === "OB" ? "Order block" : zoneTap.zone.kind === "FVG" ? "Fair value gap" : "Breaker"} POI`,
        `1H equilibrium ${equilibriumOk ? "alignment" : "counter-trend"}`,
        `${selectedBosTimeframe} BOS`,
      ];
      if (breakerBonus) confluences.push("Breaker block confluence");
      if (activeSweep.level.kind === "PDH" || activeSweep.level.kind === "PDL") {
        confluences.push("Previous-day liquidity");
      }

      signal = {
        direction: provisionalDirection,
        entry: Number(price.toFixed(2)),
        stop: Number(stop.toFixed(2)),
        target: Number(target.toFixed(2)),
        rr: config.rr,
        riskPoints: Number(risk.toFixed(2)),
        triggerTime: triggerBos.time,
        sweepTime: activeSweep.time,
        tapTime: zoneTap.tapTime,
        grade: gradeFor(score),
        score,
        confluences,
        reasons: [
          `HTF ${aligned ? "alignment" : "conflict resolved"}: ${contextLabel}.`,
          `${activeSweep.level.label} liquidity swept at ${toNyTime(activeSweep.time)} ET.`,
          `${zoneTap.zone.kind} tapped at ${toNyTime(zoneTap.tapTime)} ET; 1M BOS confirmed at ${toNyTime(triggerBos.time)} ET.`,
          `Entry inside ${config.observationStart}–${config.observationEnd} ET observation window.`,
        ],
        zone: zoneTap.zone,
        sweep: activeSweep,
        bosTimeframe: selectedBosTimeframe!,
        equilibrium,
      };
      reason = `${provisionalDirection} setup armed: ${activeSweep.level.label} swept, ${zoneTap.zone.kind} tapped, 1M BOS confirmed.`;
    }
  }

  if (state === "TRIGGERED" && !signal) {
    state = "AWAITING_ENTRY";
    reason = "Trigger appeared, but the structural stop is too tight to model a valid R:R. Waiting for the next confirmation.";
  }

  const equilibriumForOutput: EquilibriumState = equilibrium;
  const labels = signal?.confluences ?? [];
  const previewZone = zoneTap?.zone ?? null;

  return {
    asOf,
    price: Number(price.toFixed(2)),
    tradingDay: day,
    inWindow,
    windowLabel: `${config.observationStart}–${config.observationEnd} ET`,
    htf: {
      bias4h: { timeframe: "4H", direction: bias4h, structure: structure4h },
      bias1h: { timeframe: "1H", direction: bias1h, structure: structure1h },
      aligned,
      conflicted,
      unclear,
      selectedBosTimeframe,
      contextLabel,
      structure5m,
      structure15m,
      directionalBos,
    },
    liquidity: {
      levels: liquidity.levels,
      sweeps,
      activeSweep,
      eqh: liquidity.eqh,
      eql: liquidity.eql,
      pdh: liquidity.pdh,
      pdl: liquidity.pdl,
    },
    confluences: {
      fvgs,
      orderBlocks,
      breakers,
      activeZone: previewZone,
      zoneTappedRecently: !!zoneTap,
      equilibrium: equilibriumForOutput,
      equilibriumOk,
      count: [sweepOk, zoneOk, equilibriumOk, directionalBosMatches, inWindow].filter(Boolean).length,
      labels,
    },
    trigger: {
      bos1m: triggerBos ?? (last1m && expectedDirection && last1m.direction === expectedDirection ? last1m : null),
      structure1m,
      direction: provisionalDirection,
      confirmed: triggerOk,
      freshnessOk: last1m ? asOf - last1m.time <= config.entryBosFreshnessMinutes * 60 : false,
    },
    checklist,
    setup: {
      state,
      decision: signal ? signal.direction : "NO TRADE",
      grade: signal?.grade ?? null,
      reason,
      signal,
    },
    meta: {
      barsUsed: candles.length,
      evaluatedAt: new Date().toISOString(),
      lookAhead: false,
      engineVersion: ENGINE_VERSION,
    },
  };
}

/** Measure swing structure freshness for the UI header. */
export function structureAgeMinutes(eventTime: number, asOf: number): number {
  return Math.max(0, Math.round((asOf - eventTime) / 60));
}

/** Human-readable pending setup state (used by badges). */
export function stateLabel(state: StrategyAnalysis["setup"]["state"]): string {
  return SETUP_STATE_LABEL[state];
}

/** Window progress in [0,1] for the dashboard countdown. */
export function windowProgress(asOf: number, config: EngineConfig): number {
  const startMin = hhmmToMinutes(config.observationStart);
  const endMin = hhmmToMinutes(config.observationEnd);
  const m = nyMinuteOfDay(asOf);
  if (endMin <= startMin) return 0;
  return Math.max(0, Math.min(1, (m - startMin) / (endMin - startMin)));
}

export { minutesToHHMM, findPivots, isInObservationWindow };
