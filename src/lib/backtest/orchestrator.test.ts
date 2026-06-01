import { describe, expect, it } from 'vitest';
import { runFullBacktest, runAdvancedPipeline } from './orchestrator';
import type { Bar, BacktestConfig } from '@/types/backtest';

// Generate enough bars to satisfy regime (60), ml-signal (50), robustness (10 trades).
function makeBars(n: number): Bar[] {
  return Array.from({ length: n }, (_, i) => {
    const c = 100 + Math.sin(i / 5) * 2 + i * 0.05;
    return {
      ts:     new Date(2026, 0, 1, 0, i).toISOString(),
      open:   c - 0.05,
      high:   c + 0.1,
      low:    c - 0.1,
      close:  c,
      volume: 1000,
    };
  });
}

function baseCfg(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    symbol:           'XAUUSD',
    timeframe:        'M1',
    from:             new Date(2026, 0, 1).toISOString(),
    to:               new Date(2026, 0, 2).toISOString(),
    initialBalance:   10_000,
    contractSize:     100,
    pointValue:       1,
    spreadPoints:     0,
    commissionPerLot: 0,
    slippagePoints:   0,
    direction:        'both',
    parameters:       {},
    rules: {
      sizing: { mode: 'fixed_lot', value: 0.01 },
    },
    ...overrides,
  };
}

describe('orchestrator advanced opt-in pipeline', () => {
  it('baseline-only run leaves advanced=null when no flags set', async () => {
    const bars = makeBars(120);
    const out = await runFullBacktest(bars, baseCfg());
    expect(out.advanced).toBeNull();
  });

  it('useMl=true produces an ml block with trainAcc and validAcc', async () => {
    const bars = makeBars(120);
    const out = await runFullBacktest(bars, baseCfg({ useMl: true }));
    expect(out.advanced).not.toBeNull();
    expect(out.advanced?.ml).not.toBeNull();
    expect(out.advanced?.ml?.used).toBe(true);
    expect(typeof out.advanced?.ml?.trainAcc).toBe('number');
    expect(typeof out.advanced?.ml?.validAcc).toBe('number');
    expect(out.advanced?.ml?.featureNames.length).toBeGreaterThan(0);
  });

  it('useMultiTf=true surfaces the higherTimeframes plan', async () => {
    const bars = makeBars(120);
    const out = await runFullBacktest(bars, baseCfg({
      useMultiTf:    true,
      multiTfParams: { higherTimeframes: ['H1', 'H4'] },
    }));
    expect(out.advanced?.multiTf).toEqual({
      used:             true,
      higherTimeframes: ['H1', 'H4'],
    });
  });

  it('usePortfolio=true surfaces pending status with reason (real run happens in run-job)', async () => {
    const bars = makeBars(120);
    const out = await runFullBacktest(bars, baseCfg({ usePortfolio: true }));
    const p = out.advanced?.portfolio;
    expect(p?.used).toBe(true);
    expect(p?.status).toBe('pending');
    if (p?.status === 'pending') {
      expect(p.reason).toMatch(/Supabase/);
    }
  });

  it('flags off → baseline metrics identical to flags on (no contamination)', async () => {
    const bars = makeBars(120);
    const off = await runFullBacktest(bars, baseCfg());
    const on  = await runFullBacktest(bars, baseCfg({ useMl: true, useMultiTf: true }));
    // Baseline metrics must match exactly — advanced pipeline does not mutate baseline.
    expect(on.baseline.metrics).toEqual(off.baseline.metrics);
    expect(on.baseline.finalBalance).toBe(off.baseline.finalBalance);
  });
});

// Direct helper tests — the sync endpoint /api/algorithms/[id]/engine-backtest
// calls runAdvancedPipeline() without going through runFullBacktest, so we
// verify the helper in isolation.
describe('runAdvancedPipeline (sync endpoint path)', () => {
  it('all flags off → advanced=null, no warnings', () => {
    const bars = makeBars(100);
    const out  = runAdvancedPipeline(bars, baseCfg());
    expect(out.advanced).toBeNull();
    expect(out.warnings).toEqual([]);
  });

  it('useMl with <50 bars → ml stays null, no throw', () => {
    const bars = makeBars(20);
    const out  = runAdvancedPipeline(bars, baseCfg({ useMl: true }));
    expect(out.advanced).not.toBeNull();
    expect(out.advanced?.ml).toBeNull();
  });

  it('useMl with enough bars → ml block populated', () => {
    const bars = makeBars(120);
    const out  = runAdvancedPipeline(bars, baseCfg({ useMl: true }));
    expect(out.advanced?.ml?.used).toBe(true);
    expect(typeof out.advanced?.ml?.trainAcc).toBe('number');
    expect(typeof out.advanced?.ml?.validAcc).toBe('number');
  });

  it('useMultiTf default → ["H4", "D1"]', () => {
    const bars = makeBars(60);
    const out  = runAdvancedPipeline(bars, baseCfg({ useMultiTf: true }));
    expect(out.advanced?.multiTf?.higherTimeframes).toEqual(['H4', 'D1']);
  });

  it('useMultiTf custom → respects multiTfParams', () => {
    const bars = makeBars(60);
    const out  = runAdvancedPipeline(bars, baseCfg({
      useMultiTf:    true,
      multiTfParams: { higherTimeframes: ['H1'] },
    }));
    expect(out.advanced?.multiTf?.higherTimeframes).toEqual(['H1']);
  });

  it('all three flags together → all three sub-blocks present', () => {
    const bars = makeBars(120);
    const out  = runAdvancedPipeline(bars, baseCfg({
      useMl:        true,
      useMultiTf:   true,
      usePortfolio: true,
    }));
    expect(out.advanced?.ml).not.toBeNull();
    expect(out.advanced?.multiTf).not.toBeNull();
    expect(out.advanced?.portfolio).not.toBeNull();
  });
});
