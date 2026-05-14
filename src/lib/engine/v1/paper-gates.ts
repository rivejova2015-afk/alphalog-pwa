// Paper-trading gates — evaluate accumulated paper trades to decide whether a
// strategy has proven itself enough to advance paper → approved. This is the
// lifecycle step after the engine-backtest gates (which handle draft → paper).
//
// Pure function over closed paper trades; the cron supplies the rows.

export interface PaperTrade {
  pnl: number | null;
  status: string;
  closed_at: string | null;
  opened_at: string;
}

export interface PaperGateDef {
  key: string;
  label: string;
  tier: "must" | "should";
}

export interface PaperGateResult extends PaperGateDef {
  value: number;
  threshold: number;
  passed: boolean;
}

export interface PaperGateEvaluation {
  results: PaperGateResult[];
  closedTrades: number;
  totalPnl: number;
  winRate: number;
  daysLive: number;
  allMustPassed: boolean;
  eligibleForApproved: boolean;
}

// Conservative bar — a strategy clearing these has shown a real edge in
// forward (paper) conditions, not just on historical replay.
const MIN_CLOSED_TRADES = 15;
const MIN_DAYS_LIVE = 5;
const MIN_WIN_RATE = 0.40;
const SHOULD_MIN_PROFIT_FACTOR = 1.2;

export function evaluatePaperGates(trades: PaperTrade[], now: Date = new Date()): PaperGateEvaluation {
  const closed = trades.filter((t) => t.status === "closed" && t.closed_at != null);
  const closedTrades = closed.length;

  let totalPnl = 0;
  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let earliestOpen = Infinity;

  for (const t of closed) {
    const pnl = t.pnl ?? 0;
    totalPnl += pnl;
    if (pnl > 0) { wins++; grossProfit += pnl; }
    else { grossLoss += Math.abs(pnl); }
    const openMs = new Date(t.opened_at).getTime();
    if (Number.isFinite(openMs) && openMs < earliestOpen) earliestOpen = openMs;
  }

  const winRate = closedTrades > 0 ? wins / closedTrades : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
  const daysLive = Number.isFinite(earliestOpen)
    ? (now.getTime() - earliestOpen) / (24 * 60 * 60 * 1000)
    : 0;

  const results: PaperGateResult[] = [
    {
      key: "closed_trades", label: `Min ${MIN_CLOSED_TRADES} closed trades`, tier: "must",
      value: closedTrades, threshold: MIN_CLOSED_TRADES, passed: closedTrades >= MIN_CLOSED_TRADES,
    },
    {
      key: "days_live", label: `Min ${MIN_DAYS_LIVE} days in paper`, tier: "must",
      value: +daysLive.toFixed(1), threshold: MIN_DAYS_LIVE, passed: daysLive >= MIN_DAYS_LIVE,
    },
    {
      key: "total_pnl", label: "Positive aggregate PnL", tier: "must",
      value: +totalPnl.toFixed(2), threshold: 0, passed: totalPnl > 0,
    },
    {
      key: "win_rate", label: `Win rate >= ${(MIN_WIN_RATE * 100).toFixed(0)}%`, tier: "must",
      value: +winRate.toFixed(4), threshold: MIN_WIN_RATE, passed: winRate >= MIN_WIN_RATE,
    },
    {
      key: "profit_factor", label: `Profit factor >= ${SHOULD_MIN_PROFIT_FACTOR}`, tier: "should",
      value: Number.isFinite(profitFactor) ? +profitFactor.toFixed(2) : 999,
      threshold: SHOULD_MIN_PROFIT_FACTOR,
      passed: profitFactor >= SHOULD_MIN_PROFIT_FACTOR,
    },
  ];

  const must = results.filter((r) => r.tier === "must");
  const allMustPassed = must.length > 0 && must.every((r) => r.passed);

  return {
    results,
    closedTrades,
    totalPnl: +totalPnl.toFixed(2),
    winRate: +winRate.toFixed(4),
    daysLive: +daysLive.toFixed(1),
    allMustPassed,
    eligibleForApproved: allMustPassed,
  };
}
