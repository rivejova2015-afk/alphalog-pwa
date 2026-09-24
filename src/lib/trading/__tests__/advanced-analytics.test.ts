import { describe, it, expect } from 'vitest';
import {
  calculateAdvancedMetrics,
  detectTradePatterns,
  calculateSymbolCorrelations,
} from '../advanced-analytics';

describe('Advanced Analytics', () => {
  // Mock trade data
  const mockTrades = [
    {
      id: '1',
      pnl: 100,
      pnl_percent: 5,
      entry_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      exit_date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      symbol: 'EURUSD',
      setup_id: 'setup-1',
    },
    {
      id: '2',
      pnl: 150,
      pnl_percent: 7.5,
      entry_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      exit_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      symbol: 'GBPUSD',
      setup_id: 'setup-1',
    },
    {
      id: '3',
      pnl: -50,
      pnl_percent: -2.5,
      entry_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      exit_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      symbol: 'EURUSD',
      setup_id: 'setup-2',
    },
    {
      id: '4',
      pnl: 200,
      pnl_percent: 10,
      entry_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      exit_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      symbol: 'GBPUSD',
      setup_id: 'setup-1',
    },
    {
      id: '5',
      pnl: -100,
      pnl_percent: -5,
      entry_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      exit_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      symbol: 'EURUSD',
      setup_id: 'setup-2',
    },
  ];

  describe('calculateAdvancedMetrics', () => {
    it('should calculate win rate correctly', () => {
      const metrics = calculateAdvancedMetrics(mockTrades);
      // 3 wins out of 5 trades = 60%
      expect(metrics.win_rate).toBe(0.6);
    });

    it('should calculate profit factor correctly', () => {
      const metrics = calculateAdvancedMetrics(mockTrades);
      // Gross profit: 100 + 150 + 200 = 450
      // Gross loss: 50 + 100 = 150
      // Profit factor: 450 / 150 = 3
      expect(metrics.profit_factor).toBeCloseTo(3, 1);
    });

    it('should count winning and losing trades', () => {
      const metrics = calculateAdvancedMetrics(mockTrades);
      expect(metrics.winning_trades).toBe(3);
      expect(metrics.losing_trades).toBe(2);
      expect(metrics.total_trades).toBe(5);
    });

    it('should handle empty trades', () => {
      const metrics = calculateAdvancedMetrics([]);
      expect(metrics.total_trades).toBe(0);
      expect(metrics.win_rate).toBe(0);
      expect(metrics.profit_factor).toBe(0);
    });

    it('should calculate sharpe ratio', () => {
      const metrics = calculateAdvancedMetrics(mockTrades);
      expect(typeof metrics.sharpe_ratio).toBe('number');
      expect(metrics.sharpe_ratio).toBeGreaterThanOrEqual(-10);
      expect(metrics.sharpe_ratio).toBeLessThanOrEqual(10);
    });

    it('should track consecutive wins and losses', () => {
      const metrics = calculateAdvancedMetrics(mockTrades);
      expect(metrics.consecutive_wins).toBeGreaterThan(0);
      expect(metrics.consecutive_losses).toBeGreaterThan(0);
    });

    it('should calculate average trade duration', () => {
      const metrics = calculateAdvancedMetrics(mockTrades);
      // Each trade is 1 day = 24 hours
      expect(metrics.avg_trade_duration_hours).toBeCloseTo(24, 0);
    });
  });

  describe('detectTradePatterns', () => {
    it('should detect patterns from similar setups', () => {
      const patterns = detectTradePatterns(mockTrades);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should calculate pattern win rates', () => {
      const patterns = detectTradePatterns(mockTrades);
      for (const pattern of patterns) {
        expect(pattern.win_rate).toBeGreaterThanOrEqual(0);
        expect(pattern.win_rate).toBeLessThanOrEqual(1);
      }
    });

    it('should ignore patterns with < 3 trades', () => {
      const singleTradeMocks = [mockTrades[0]];
      const patterns = detectTradePatterns(singleTradeMocks);
      expect(patterns.length).toBe(0);
    });

    it('should calculate risk reward ratio', () => {
      const patterns = detectTradePatterns(mockTrades);
      for (const pattern of patterns) {
        expect(pattern.risk_reward_ratio).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateSymbolCorrelations', () => {
    it('should calculate correlations between symbols', () => {
      const correlations = calculateSymbolCorrelations(mockTrades, 30);
      // Should have correlation between EURUSD and GBPUSD
      expect(correlations.length).toBeGreaterThan(0);
    });

    it('should rate significance correctly', () => {
      const correlations = calculateSymbolCorrelations(mockTrades, 30);
      for (const corr of correlations) {
        expect(['strong', 'moderate', 'weak']).toContain(corr.significance);
      }
    });

    it('should be between -1 and 1', () => {
      const correlations = calculateSymbolCorrelations(mockTrades, 30);
      for (const corr of correlations) {
        expect(corr.correlation_coefficient).toBeGreaterThanOrEqual(-1);
        expect(corr.correlation_coefficient).toBeLessThanOrEqual(1);
      }
    });

    it('should ignore trades older than lookback period', () => {
      const oldTrades = [
        { ...mockTrades[0], entry_date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() },
      ];
      const correlations = calculateSymbolCorrelations(oldTrades, 30);
      expect(correlations.length).toBe(0);
    });
  });
});
