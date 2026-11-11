import { describe, expect, it } from "vitest";
import { calculatePositionSize, pointsToTicks, roundToTick } from "@/lib/engine/risk";

describe("NQ / MNQ contract math", () => {
  it("uses NQ $20 per point and $5 per 0.25 tick", () => {
    const result = calculatePositionSize({
      instrument: "NQ",
      accountSize: 100000,
      riskPct: 1,
      entry: 18000,
      stop: 17990,
      maxMarginPct: 1000,
    });
    expect(result.pointValue).toBe(20);
    expect(result.tickSize).toBe(0.25);
    expect(result.tickValue).toBe(5);
    expect(result.stopDistancePoints).toBe(10);
    expect(result.stopDistanceTicks).toBe(40);
    expect(result.riskPerContract).toBe(200);
    expect(result.contracts).toBe(5);
    expect(result.riskActual).toBe(1000);
  });

  it("uses MNQ $2 per point and $0.50 per tick", () => {
    const result = calculatePositionSize({
      instrument: "MNQ",
      accountSize: 100000,
      riskPct: 1,
      entry: 18000,
      stop: 17990,
      maxMarginPct: 1000,
    });
    expect(result.pointValue).toBe(2);
    expect(result.tickSize).toBe(0.25);
    expect(result.tickValue).toBe(0.5);
    expect(result.riskPerContract).toBe(20);
    expect(result.contracts).toBe(50);
    expect(result.riskActual).toBe(1000);
  });

  it("caps size by the margin budget", () => {
    const result = calculatePositionSize({
      instrument: "NQ",
      accountSize: 100000,
      riskPct: 1,
      entry: 18000,
      stop: 17990,
      maxMarginPct: 50,
    });
    expect(result.marginCapApplied).toBe(true);
    expect(result.contracts).toBe(2);
    expect(result.estMargin).toBe(44000);
  });

  it("derives a target from R and computes break-even win rate", () => {
    const result = calculatePositionSize({
      instrument: "MNQ",
      accountSize: 50000,
      riskPct: 1,
      entry: 18000,
      stop: 17980,
      rr: 2,
    });
    expect(result.direction).toBe("LONG");
    expect(result.target).toBe(18040);
    expect(result.rr).toBe(2);
    expect(result.breakevenWinRate).toBeCloseTo(33.33, 1);
  });

  it("rejects invalid risk and equal entry/stop", () => {
    const invalidRisk = calculatePositionSize({ instrument: "NQ", accountSize: 100000, riskPct: 0, entry: 18000, stop: 17990 });
    expect(invalidRisk.valid).toBe(false);
    expect(invalidRisk.error).toMatch(/Risk/);

    const equal = calculatePositionSize({ instrument: "MNQ", accountSize: 100000, riskPct: 1, entry: 18000, stop: 18000 });
    expect(equal.error).toMatch(/equal/);
  });

  it("rounds prices and points to exact ticks", () => {
    expect(roundToTick(18000.13, "NQ")).toBe(18000.25);
    expect(pointsToTicks(10, "MNQ")).toBe(40);
  });
});
