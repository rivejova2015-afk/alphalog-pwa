import type { SimulatedTrade, EquityPoint, BacktestMetrics } from '@/types/backtest';

const TRADING_DAYS_PER_YEAR = 252;

function safeDiv(n: number, d: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return n / d;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function downsideDeviation(returns: number[]): number {
  const negatives = returns.filter((r) => r < 0);
  if (negatives.length === 0) return 0;
  const mean = negatives.reduce((a, b) => a + b, 0) / negatives.length;
  const variance = negatives.reduce((a, b) => a + (b - mean) ** 2, 0) / negatives.length;
  return Math.sqrt(variance);
}

function maxDrawdown(equity: EquityPoint[]): { abs: number; pct: number } {
  if (equity.length === 0) return { abs: 0, pct: 0 };
  let peak = equity[0].equity;
  let maxAbs = 0;
  let maxPct = 0;
  for (const p of equity) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak - p.equity;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxAbs) maxAbs = dd;
    if (ddPct > maxPct) maxPct = ddPct;
  }
  return { abs: maxAbs, pct: maxPct };
}

function consecutiveStreaks(trades: SimulatedTrade[]): { winsMax: number; lossesMax: number } {
  let curWin = 0, curLoss = 0, maxW = 0, maxL = 0;
  for (const t of trades) {
    if (t.pnl > 0) { curWin++; curLoss = 0; if (curWin > maxW) maxW = curWin; }
    else if (t.pnl < 0) { curLoss++; curWin = 0; if (curLoss > maxL) maxL = curLoss; }
    else { curWin = 0; curLoss = 0; }
  }
  return { winsMax: maxW, lossesMax: maxL };
}

function kRatio(equity: EquityPoint[]): number {
  if (equity.length < 3) return 0;
  const n = equity.length;
  const xMean = (n - 1) / 2;
  let sxx = 0, sxy = 0, yMean = 0;
  for (let i = 0; i < n; i++) yMean += Math.log(Math.max(equity[i].equity, 1e-9));
  yMean /= n;
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const xi = i - xMean;
    const yi = Math.log(Math.max(equity[i].equity, 1e-9)) - yMean;
    sxx += xi * xi;
    sxy += xi * yi;
    ys.push(Math.log(Math.max(equity[i].equity, 1e-9)));
  }
  if (sxx === 0) return 0;
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    sse += (ys[i] - pred) ** 2;
  }
  const seSlope = Math.sqrt(sse / Math.max(1, n - 2)) / Math.sqrt(sxx);
  if (seSlope === 0) return 0;
  return safeDiv(slope, seSlope) * Math.sqrt(n);
}

export function computeMetrics(
  trades: SimulatedTrade[],
  equity: EquityPoint[],
  initialBalance: number,
): BacktestMetrics {
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;
  const avgWin = wins.length > 0 ? grossWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const expectancy = totalTrades > 0 ? totalPnl / totalTrades : 0;
  const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  const tradeReturns = trades.map((t) => t.pnlPct);
  const meanRet = tradeReturns.length > 0 ? tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length : 0;
  const sdRet = stdev(tradeReturns);
  const ddRet = downsideDeviation(tradeReturns);
  const annFactor = Math.sqrt(TRADING_DAYS_PER_YEAR);
  const sharpe = sdRet > 0 ? (meanRet / sdRet) * annFactor : 0;
  const sortino = ddRet > 0 ? (meanRet / ddRet) * annFactor : 0;

  const dd = maxDrawdown(equity);
  const totalReturnPct = initialBalance > 0 ? totalPnl / initialBalance : 0;
  const calmar = dd.pct > 0 ? totalReturnPct / dd.pct : 0;
  const recoveryFactor = dd.abs > 0 ? totalPnl / dd.abs : 0;

  const streaks = consecutiveStreaks(trades);
  const kr = kRatio(equity);

  return {
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    winRate: +winRate.toFixed(4),
    totalPnl: +totalPnl.toFixed(2),
    totalReturnPct: +totalReturnPct.toFixed(4),
    profitFactor: +profitFactor.toFixed(3),
    expectancy: +expectancy.toFixed(2),
    sharpe: +sharpe.toFixed(3),
    sortino: +sortino.toFixed(3),
    calmar: +calmar.toFixed(3),
    maxDrawdown: +dd.abs.toFixed(2),
    maxDrawdownPct: +dd.pct.toFixed(4),
    recoveryFactor: +recoveryFactor.toFixed(3),
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    avgWinLossRatio: +avgWinLossRatio.toFixed(3),
    consecutiveWinsMax: streaks.winsMax,
    consecutiveLossesMax: streaks.lossesMax,
    k_ratio: +kr.toFixed(3),
  };
}
