/**
 * Advanced Trading Analytics
 * Pattern recognition, risk-adjusted metrics, correlation analysis
 */

export interface TradeAnalytics {
  id: string;
  user_id: string;
  win_rate: number;
  profit_factor: number;
  expectancy: number;
  sharpe_ratio: number;
  max_drawdown: number;
  recovery_factor: number;
  avg_trade_duration_hours: number;
  consecutive_wins: number;
  consecutive_losses: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
}

export interface TradePattern {
  pattern_name: string;
  frequency: number;
  avg_return_percent: number;
  win_rate: number;
  risk_reward_ratio: number;
  confidence_score: number;
}

export interface TradeCorrelation {
  symbol1: string;
  symbol2: string;
  correlation_coefficient: number;
  lookback_days: number;
  significance: 'strong' | 'moderate' | 'weak';
}

/**
 * Calculate advanced trading metrics
 */
export function calculateAdvancedMetrics(trades: any[]): TradeAnalytics {
  if (trades.length === 0) {
    return {
      id: '',
      user_id: '',
      win_rate: 0,
      profit_factor: 0,
      expectancy: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      recovery_factor: 0,
      avg_trade_duration_hours: 0,
      consecutive_wins: 0,
      consecutive_losses: 0,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
    };
  }

  const closedTrades = trades.filter((t) => t.pnl !== null && t.pnl !== undefined);

  if (closedTrades.length === 0) return {} as TradeAnalytics;

  // Win rate
  const winningTrades = closedTrades.filter((t) => t.pnl > 0);
  const losingTrades = closedTrades.filter((t) => t.pnl < 0);
  const winRate = winningTrades.length / closedTrades.length;

  // Profit factor
  const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(
    losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
  );
  const profitFactor = grossLoss === 0 ? 0 : grossProfit / grossLoss;

  // Expectancy
  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  const expectancy = avgWin * winRate - avgLoss * (1 - winRate);

  // Sharpe ratio (simplified)
  const returns = closedTrades.map((t) => (t.pnl_percent || 0) / 100);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev === 0 ? 0 : (avgReturn * 252) / (stdDev * Math.sqrt(252));

  // Max drawdown (simplified)
  let maxDD = 0;
  let peak = 0;
  let cumProfit = 0;
  for (const trade of closedTrades) {
    cumProfit += trade.pnl || 0;
    if (cumProfit > peak) peak = cumProfit;
    const dd = ((peak - cumProfit) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  // Recovery factor
  const totalPnl = grossProfit - grossLoss;
  const recoveryFactor = maxDD === 0 ? 0 : Math.abs(totalPnl) / maxDD;

  // Consecutive wins/losses
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let consec_wins = 0;
  let consec_losses = 0;

  for (const trade of closedTrades) {
    if (trade.pnl > 0) {
      consec_wins++;
      consec_losses = 0;
      maxConsecWins = Math.max(maxConsecWins, consec_wins);
    } else if (trade.pnl < 0) {
      consec_losses++;
      consec_wins = 0;
      maxConsecLosses = Math.max(maxConsecLosses, consec_losses);
    }
  }

  // Avg trade duration
  let totalHours = 0;
  for (const trade of closedTrades) {
    if (trade.entry_date && trade.exit_date) {
      const hours =
        (new Date(trade.exit_date).getTime() -
          new Date(trade.entry_date).getTime()) /
        (1000 * 60 * 60);
      totalHours += hours;
    }
  }
  const avgTradeDuration = closedTrades.length > 0 ? totalHours / closedTrades.length : 0;

  return {
    id: '',
    user_id: '',
    win_rate: Math.min(winRate, 1),
    profit_factor: profitFactor,
    expectancy: expectancy,
    sharpe_ratio: sharpeRatio,
    max_drawdown: maxDD / 100,
    recovery_factor: recoveryFactor,
    avg_trade_duration_hours: avgTradeDuration,
    consecutive_wins: maxConsecWins,
    consecutive_losses: maxConsecLosses,
    total_trades: closedTrades.length,
    winning_trades: winningTrades.length,
    losing_trades: losingTrades.length,
  };
}

/**
 * Detect trading patterns from recent trades
 */
export function detectTradePatterns(trades: any[]): TradePattern[] {
  const patterns: TradePattern[] = [];

  // Group trades by setup
  const setupGroups = new Map<string, any[]>();
  for (const trade of trades) {
    if (trade.setup_id) {
      if (!setupGroups.has(trade.setup_id)) {
        setupGroups.set(trade.setup_id, []);
      }
      setupGroups.get(trade.setup_id)!.push(trade);
    }
  }

  // Analyze each setup as a pattern
  for (const [setupId, setupTrades] of setupGroups) {
    const closedTrades = setupTrades.filter((t) => t.pnl !== null);
    if (closedTrades.length < 3) continue; // Minimum trades to consider a pattern

    const winning = closedTrades.filter((t) => t.pnl > 0);
    const losing = closedTrades.filter((t) => t.pnl < 0);

    if (winning.length === 0 || losing.length === 0) continue;

    const avgWinReturn =
      winning.reduce((sum, t) => sum + (t.pnl || 0), 0) / winning.length;
    const avgLossReturn =
      losing.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / losing.length;

    patterns.push({
      pattern_name: `Setup ${setupId.substring(0, 8)}`,
      frequency: closedTrades.length,
      avg_return_percent: (
        closedTrades.reduce((sum, t) => sum + (t.pnl_percent || 0), 0) /
        closedTrades.length
      ),
      win_rate: winning.length / closedTrades.length,
      risk_reward_ratio: avgWinReturn / avgLossReturn,
      confidence_score: Math.min(closedTrades.length / 20, 1), // Max confidence at 20 trades
    });
  }

  return patterns.sort((a, b) => b.confidence_score - a.confidence_score);
}

/**
 * Calculate correlation between trading symbols
 */
export function calculateSymbolCorrelations(
  trades: any[],
  lookbackDays: number = 30,
): TradeCorrelation[] {
  const correlations: TradeCorrelation[] = [];

  // Group trades by symbol
  const symbols = new Set<string>();
  const symbolReturns = new Map<string, number[]>();

  for (const trade of trades) {
    if (
      trade.symbol &&
      new Date(trade.entry_date).getTime() >
        Date.now() - lookbackDays * 24 * 60 * 60 * 1000
    ) {
      symbols.add(trade.symbol);
      if (!symbolReturns.has(trade.symbol)) {
        symbolReturns.set(trade.symbol, []);
      }
      symbolReturns.get(trade.symbol)!.push(trade.pnl_percent || 0);
    }
  }

  // Calculate correlations between symbols
  const symbolArray = Array.from(symbols);
  for (let i = 0; i < symbolArray.length; i++) {
    for (let j = i + 1; j < symbolArray.length; j++) {
      const returns1 = symbolReturns.get(symbolArray[i]) || [];
      const returns2 = symbolReturns.get(symbolArray[j]) || [];

      // Only correlate if both have at least 3 trades
      if (returns1.length < 3 || returns2.length < 3) continue;

      // Simple correlation calculation
      const minLen = Math.min(returns1.length, returns2.length);
      let correlation = 0;

      if (minLen > 1) {
        const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
        const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

        let covariance = 0;
        let variance1 = 0;
        let variance2 = 0;

        for (let k = 0; k < minLen; k++) {
          const diff1 = returns1[k] - mean1;
          const diff2 = returns2[k] - mean2;
          covariance += diff1 * diff2;
          variance1 += diff1 * diff1;
          variance2 += diff2 * diff2;
        }

        const denominator = Math.sqrt(variance1 * variance2);
        correlation = denominator === 0 ? 0 : covariance / denominator;
      }

      let significance: 'strong' | 'moderate' | 'weak' = 'weak';
      if (Math.abs(correlation) > 0.7) significance = 'strong';
      else if (Math.abs(correlation) > 0.4) significance = 'moderate';

      correlations.push({
        symbol1: symbolArray[i],
        symbol2: symbolArray[j],
        correlation_coefficient: correlation,
        lookback_days: lookbackDays,
        significance,
      });
    }
  }

  return correlations.sort((a, b) => Math.abs(b.correlation_coefficient) - Math.abs(a.correlation_coefficient));
}
