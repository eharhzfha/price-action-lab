import type {
  Candle,
  EquilibriumState,
  StructureAnalysis,
  TradeDirection,
  Zone,
} from "./types";

const TAP_FRESHNESS_MINUTES = 20;

function overlaps(candle: Candle, top: number, bottom: number, tolerance = 0): boolean {
  return candle.low <= top + tolerance && candle.high >= bottom - tolerance;
}

function buildZone(
  kind: Zone["kind"],
  direction: TradeDirection,
  top: number,
  bottom: number,
  startTime: number,
  formationTime: number,
  strength: number,
): Zone {
  return {
    id: `${kind}_${direction}_${formationTime}_${bottom.toFixed(2)}`,
    kind,
    direction,
    top: Number(top.toFixed(2)),
    bottom: Number(bottom.toFixed(2)),
    midpoint: Number(((top + bottom) / 2).toFixed(2)),
    startTime,
    endTime: null,
    tapped: false,
    lastTapTime: null,
    invalidated: false,
    strength: Number(strength.toFixed(2)),
  };
}

/**
 * Fair Value Gaps (3-candle imbalance) with mitigation tracking.
 * Only gaps formed inside the requested lookback are returned.
 */
export function detectFvgs(
  candles: Candle[],
  asOf: number,
  lookbackMinutes = 180,
  minGapPoints = 0.25,
  tolerance = 0.1,
): Zone[] {
  const cutoff = asOf - lookbackMinutes * 60;
  const zones: Zone[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    if (c.time < cutoff) continue;
    const a = candles[i - 2];
    const gapUp = c.low - a.high;
    const gapDown = a.low - c.high;

    let zone: Zone | null = null;
    if (gapUp >= minGapPoints) {
      zone = buildZone("FVG", "LONG", c.low, a.high, candles[i - 1].time, c.time, gapUp);
    } else if (gapDown >= minGapPoints) {
      zone = buildZone("FVG", "SHORT", a.low, c.high, candles[i - 1].time, c.time, gapDown);
    }
    if (!zone) continue;

    for (let j = i + 1; j < candles.length; j++) {
      const later = candles[j];
      if (later.time > asOf) break;
      if (overlaps(later, zone.top, zone.bottom, tolerance)) {
        zone.tapped = true;
        zone.lastTapTime = later.time;
      }
      if (zone.direction === "LONG" && later.close < zone.bottom - tolerance) {
        zone.invalidated = true;
        break;
      }
      if (zone.direction === "SHORT" && later.close > zone.top + tolerance) {
        zone.invalidated = true;
        break;
      }
    }

    zones.push(zone);
  }

  return zones;
}

/**
 * Order blocks: the last opposing candle before a displacement that breaks
 * structure. Invalidated blocks are re-labelled as breaker blocks.
 */
export function detectOrderBlocks(
  candles: Candle[],
  structure1m: StructureAnalysis,
  asOf: number,
  lookbackMinutes = 180,
): { orderBlocks: Zone[]; breakers: Zone[] } {
  const cutoff = asOf - lookbackMinutes * 60;
  const orderBlocks: Zone[] = [];
  const breakers: Zone[] = [];
  const seen = new Set<number>();

  const events = structure1m.events.filter((e) => e.time >= cutoff && e.time <= asOf);

  for (const event of events) {
    if (seen.has(event.index)) continue;
    seen.add(event.index);

    let originIndex = -1;
    for (let j = event.index - 1; j >= Math.max(0, event.index - 12); j--) {
      const candidate = candles[j];
      if (
        (event.direction === "BULLISH" && candidate.close < candidate.open) ||
        (event.direction === "BEARISH" && candidate.close > candidate.open)
      ) {
        originIndex = j;
        break;
      }
    }
    if (originIndex < 0) continue;

    const origin = candles[originIndex];
    const direction: TradeDirection = event.direction === "BULLISH" ? "LONG" : "SHORT";
    const height = origin.high - origin.low;
    if (!(height > 0)) continue;

    const zone = buildZone(
      "OB",
      direction,
      origin.high,
      origin.low,
      origin.time,
      event.time,
      height,
    );

    let invalidated = false;
    for (let j = event.index + 1; j < candles.length; j++) {
      const later = candles[j];
      if (later.time > asOf) break;
      if (overlaps(later, zone.top, zone.bottom)) {
        zone.tapped = true;
        zone.lastTapTime = later.time;
      }
      if (zone.direction === "LONG" && later.close < zone.bottom) {
        invalidated = true;
        break;
      }
      if (zone.direction === "SHORT" && later.close > zone.top) {
        invalidated = true;
        break;
      }
    }

    if (!invalidated) {
      orderBlocks.push(zone);
    } else {
      // A violated order block flips polarity and becomes a breaker block.
      breakers.push({
        ...zone,
        id: `BREAKER_${zone.direction}_${zone.startTime}`,
        kind: "BREAKER",
        direction: zone.direction === "LONG" ? "SHORT" : "LONG",
        invalidated: false,
        tapped: true,
        lastTapTime: zone.lastTapTime,
      });
    }
  }

  return {
    orderBlocks: orderBlocks.sort((a, b) => b.startTime - a.startTime).slice(0, 8),
    breakers: breakers.sort((a, b) => b.startTime - a.startTime).slice(0, 4),
  };
}

/** Equilibrium of the current 1H dealing range (premium vs discount). */
export function computeEquilibrium(structure1h: StructureAnalysis, price: number): EquilibriumState {
  const { rangeHigh, rangeLow } = structure1h;
  const equilibrium = (rangeHigh + rangeLow) / 2;
  const epsilon = Math.max(0.25, (rangeHigh - rangeLow) * 0.001);
  const location: EquilibriumState["location"] =
    price > equilibrium + epsilon ? "PREMIUM" : price < equilibrium - epsilon ? "DISCOUNT" : "AT_EQUILIBRIUM";

  return {
    rangeHigh,
    rangeLow,
    equilibrium,
    price,
    location,
    inDiscount: price < equilibrium,
    inPremium: price > equilibrium,
    source: "1H_RANGE",
  };
}

export interface ZoneTap {
  zone: Zone;
  tapTime: number;
}

/**
 * Select the most recent valid POI tap after a liquidity sweep. A tap is a
 * wick back into the zone; the subsequent 1M BOS is the entry trigger.
 */
export function findRecentZoneTap(
  zones: Zone[],
  direction: TradeDirection,
  asOf: number,
  afterTime: number,
  price: number,
  options?: { freshnessMinutes?: number; tolerance?: number },
): ZoneTap | null {
  const freshness = (options?.freshnessMinutes ?? TAP_FRESHNESS_MINUTES) * 60;
  const tolerance = options?.tolerance ?? 0.5;
  let best: ZoneTap | null = null;
  let bestScore = -Infinity;

  for (const zone of zones) {
    if (zone.direction !== direction || zone.invalidated || !zone.tapped) continue;
    if (zone.lastTapTime === null || zone.lastTapTime < afterTime) continue;
    if (zone.lastTapTime < asOf - freshness) continue;
    if (zone.lastTapTime > asOf) continue;
    if (direction === "LONG" && price < zone.bottom - tolerance) continue;
    if (direction === "SHORT" && price > zone.top + tolerance) continue;

    const kindScore = zone.kind === "OB" ? 30 : zone.kind === "BREAKER" ? 20 : 10;
    const recency = zone.lastTapTime / 1000;
    const score = kindScore + recency;
    if (score > bestScore) {
      bestScore = score;
      best = { zone, tapTime: zone.lastTapTime };
    }
  }

  return best;
}

/** POIs that price is currently trading inside (for chart highlighting). */
export function zonesAtPrice(zones: Zone[], price: number, tolerance = 0.5): Zone[] {
  return zones.filter((z) => !z.invalidated && price >= z.bottom - tolerance && price <= z.top + tolerance);
}

export function zoneLabel(zone: Zone): string {
  const prefix = zone.kind === "OB" ? "Order Block" : zone.kind === "FVG" ? "Fair Value Gap" : "Breaker Block";
  return `${prefix} · ${zone.direction === "LONG" ? "Demand" : "Supply"}`;
}
