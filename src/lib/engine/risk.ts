import { INSTRUMENTS, type Instrument } from "./types";

export interface RiskInput {
  instrument: Instrument;
  accountSize: number;
  riskPct: number;
  entry: number;
  stop: number;
  target?: number;
  rr?: number;
  maxMarginPct?: number;
}

export interface RiskResult {
  valid: boolean;
  error: string | null;
  instrument: Instrument;
  symbol: string;
  direction: "LONG" | "SHORT" | null;
  entry: number;
  stop: number;
  target: number | null;
  pointValue: number;
  tickValue: number;
  tickSize: number;
  stopDistancePoints: number;
  stopDistanceTicks: number;
  riskDollarsPlanned: number;
  riskPerContract: number;
  contracts: number;
  riskActual: number;
  riskPctActual: number;
  notional: number;
  estMargin: number;
  marginCapApplied: boolean;
  rewardPerContract: number;
  totalReward: number;
  rr: number | null;
  breakevenWinRate: number | null;
  warnings: string[];
}

export function roundToTick(price: number, instrument: Instrument): number {
  const tick = INSTRUMENTS[instrument].tickSize;
  return Math.round(price / tick) * tick;
}

export function pointsToTicks(points: number, instrument: Instrument): number {
  return Math.round(points / INSTRUMENTS[instrument].tickSize);
}

/**
 * Strict NQ / MNQ position sizing.
 * NQ  = $20 per point, 0.25 tick = $5.00
 * MNQ = $2 per point, 0.25 tick = $0.50
 */
export function calculatePositionSize(input: RiskInput): RiskResult {
  const spec = INSTRUMENTS[input.instrument] ?? INSTRUMENTS.NQ;
  const warnings: string[] = [];
  const base: RiskResult = {
    valid: false,
    error: null,
    instrument: input.instrument,
    symbol: spec.symbol,
    direction: null,
    entry: input.entry,
    stop: input.stop,
    target: input.target ?? null,
    pointValue: spec.pointValue,
    tickValue: spec.tickValue,
    tickSize: spec.tickSize,
    stopDistancePoints: 0,
    stopDistanceTicks: 0,
    riskDollarsPlanned: 0,
    riskPerContract: 0,
    contracts: 0,
    riskActual: 0,
    riskPctActual: 0,
    notional: 0,
    estMargin: 0,
    marginCapApplied: false,
    rewardPerContract: 0,
    totalReward: 0,
    rr: null,
    breakevenWinRate: null,
    warnings,
  };

  if (!Number.isFinite(input.accountSize) || input.accountSize <= 0) {
    return { ...base, error: "Account size must be greater than zero." };
  }
  if (!Number.isFinite(input.riskPct) || input.riskPct <= 0 || input.riskPct > 20) {
    return { ...base, error: "Risk % must be between 0 and 20." };
  }
  if (!Number.isFinite(input.entry) || !Number.isFinite(input.stop) || input.entry <= 0 || input.stop <= 0) {
    return { ...base, error: "Entry and stop must be positive prices." };
  }
  if (input.entry === input.stop) {
    return { ...base, error: "Entry and stop cannot be equal." };
  }

  const direction: "LONG" | "SHORT" = input.stop < input.entry ? "LONG" : "SHORT";
  const stopDistancePoints = Math.abs(input.entry - input.stop);
  const stopDistanceTicks = pointsToTicks(stopDistancePoints, input.instrument);
  const riskDollarsPlanned = (input.accountSize * input.riskPct) / 100;
  const riskPerContract = stopDistancePoints * spec.pointValue;
  const rawContracts = Math.floor(riskDollarsPlanned / riskPerContract);

  const maxMarginPct = input.maxMarginPct ?? 50;
  const marginBudget = input.accountSize * (maxMarginPct / 100);
  const maxByMargin = Math.max(1, Math.floor(marginBudget / spec.estMargin));
  const contracts = Math.min(rawContracts, maxByMargin);
  const marginCapApplied = rawContracts > maxByMargin;
  const estMargin = contracts * spec.estMargin;

  const riskActual = contracts * riskPerContract;
  const notional = contracts * input.entry * spec.pointValue;

  let target = input.target ?? null;
  let rr: number | null = null;
  if (target === null && input.rr && input.rr > 0) {
    target = direction === "LONG" ? input.entry + stopDistancePoints * input.rr : input.entry - stopDistancePoints * input.rr;
  }
  if (target !== null) {
    const rewardPoints = Math.abs(target - input.entry);
    rr = rewardPoints / stopDistancePoints;
    if ((direction === "LONG" && target <= input.entry) || (direction === "SHORT" && target >= input.entry)) {
      warnings.push("Target is on the wrong side of entry for the inferred direction.");
      rr = null;
    }
  }

  if (rawContracts === 0) {
    warnings.push(
      `Risk budget ($${riskDollarsPlanned.toFixed(2)}) is smaller than one ${input.instrument} contract at this stop ($${riskPerContract.toFixed(2)}).`,
    );
  }
  if (marginCapApplied) {
    warnings.push(
      `Position capped by ${maxMarginPct}% margin budget (${maxByMargin} contracts). Raw risk sizing allowed ${rawContracts}.`,
    );
  }
  if (stopDistanceTicks === 0) {
    warnings.push("Stop distance is smaller than one tick.");
  }

  const riskPctActual = (riskActual / input.accountSize) * 100;
  const rewardPerContract = target !== null ? Math.abs(target - input.entry) * spec.pointValue : 0;
  const totalReward = rewardPerContract * contracts;
  const breakevenWinRate = rr && rr > 0 ? 100 / (1 + rr) : null;

  return {
    ...base,
    valid: contracts > 0,
    direction,
    target: target !== null ? Number(target.toFixed(2)) : null,
    stopDistancePoints: Number(stopDistancePoints.toFixed(2)),
    stopDistanceTicks,
    riskDollarsPlanned: Number(riskDollarsPlanned.toFixed(2)),
    riskPerContract: Number(riskPerContract.toFixed(2)),
    contracts,
    riskActual: Number(riskActual.toFixed(2)),
    riskPctActual: Number(riskPctActual.toFixed(3)),
    notional: Number(notional.toFixed(2)),
    estMargin: Number(estMargin.toFixed(2)),
    marginCapApplied,
    rewardPerContract: Number(rewardPerContract.toFixed(2)),
    totalReward: Number(totalReward.toFixed(2)),
    rr: rr ? Number(rr.toFixed(2)) : null,
    breakevenWinRate: breakevenWinRate ? Number(breakevenWinRate.toFixed(2)) : null,
    warnings,
  };
}

export function rMultipleFor(pnl: number, risk: number): number {
  if (!risk) return 0;
  return pnl / risk;
}
