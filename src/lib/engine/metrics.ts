export interface EquityPoint {
  time: number;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export interface TradeLike {
  pnl: number;
  rMultiple: number;
  entryTime: number;
  exitTime: number;
  fees?: number;
  quantity?: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  profitFactor: number;
  profitFactorInfinite: boolean;
  expectancyR: number;
  expectancyDollars: number;
  avgWin: number;
  avgLoss: number;
  avgR: number;
  bestTrade: number;
  worstTrade: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  totalFees: number;
  avgHoldMinutes: number;
  maxWinStreak: number;
  maxLossStreak: number;
  rStdDev: number;
  sharpeR: number;
  returnPct: number;
}

const round = (n: number, digits = 2) => Number(n.toFixed(digits));

export function buildEquityCurve(trades: TradeLike[], startingBalance: number): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  let equity = startingBalance;
  let peak = startingBalance;
  const points: EquityPoint[] = [];
  if (sorted.length) {
    points.push({ time: sorted[0].entryTime, equity: startingBalance, drawdown: 0, drawdownPct: 0 });
  }
  for (const trade of sorted) {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    points.push({
      time: trade.exitTime,
      equity: round(equity),
      drawdown: round(equity - peak),
      drawdownPct: peak > 0 ? round(((equity - peak) / peak) * 100) : 0,
    });
  }
  return points;
}

export function computeMetrics(
  trades: TradeLike[],
  startingBalance = 100000,
  equityCurve?: EquityPoint[],
): PerformanceMetrics {
  if (!trades.length) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      winRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnl: 0,
      profitFactor: 0,
      profitFactorInfinite: false,
      expectancyR: 0,
      expectancyDollars: 0,
      avgWin: 0,
      avgLoss: 0,
      avgR: 0,
      bestTrade: 0,
      worstTrade: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      totalFees: 0,
      avgHoldMinutes: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      rStdDev: 0,
      sharpeR: 0,
      returnPct: 0,
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const breakeven = trades.length - wins.length - losses.length;
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = losses.reduce((sum, t) => sum + t.pnl, 0);
  const netPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalFees = trades.reduce((sum, t) => sum + (t.fees ?? 0), 0);
  const rValues = trades.map((t) => t.rMultiple);
  const avgR = rValues.reduce((a, b) => a + b, 0) / rValues.length;
  const variance = rValues.reduce((sum, r) => sum + (r - avgR) ** 2, 0) / rValues.length;
  const rStdDev = Math.sqrt(variance);

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let winStreak = 0;
  let lossStreak = 0;
  for (const trade of [...trades].sort((a, b) => a.exitTime - b.exitTime)) {
    if (trade.pnl > 0) {
      winStreak++;
      lossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, winStreak);
    } else if (trade.pnl < 0) {
      lossStreak++;
      winStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    }
  }

  const curve = equityCurve ?? buildEquityCurve(trades, startingBalance);
  let peak = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.equity);
    const dd = peak - point.equity;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  const holdMinutes =
    trades.reduce((sum, t) => sum + Math.max(0, (t.exitTime - t.entryTime) / 60), 0) / trades.length;

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate: round((wins.length / trades.length) * 100),
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    netPnl: round(netPnl),
    profitFactor: grossLoss < 0 ? round(grossProfit / Math.abs(grossLoss)) : grossProfit > 0 ? 99 : 0,
    profitFactorInfinite: grossLoss === 0,
    expectancyR: round(avgR),
    expectancyDollars: round(netPnl / trades.length),
    avgWin: round(wins.length ? grossProfit / wins.length : 0),
    avgLoss: round(losses.length ? grossLoss / losses.length : 0),
    avgR: round(avgR),
    bestTrade: round(Math.max(...trades.map((t) => t.pnl))),
    worstTrade: round(Math.min(...trades.map((t) => t.pnl))),
    maxDrawdown: round(maxDrawdown),
    maxDrawdownPct: round(maxDrawdownPct),
    totalFees: round(totalFees),
    avgHoldMinutes: round(holdMinutes, 1),
    maxWinStreak,
    maxLossStreak,
    rStdDev: round(rStdDev, 3),
    sharpeR: rStdDev > 0 ? round(avgR / rStdDev, 2) : 0,
    returnPct: round((netPnl / startingBalance) * 100),
  };
}
