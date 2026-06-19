import { describe, it, expect } from 'vitest';
import { buildSmcSignalRow, persistSmcSignal } from '../src/ops/smc-signal-persist.js';
import type { SmcSignal } from '../src/analysis/smc-detector.js';

function makeSignal(overrides: Partial<SmcSignal> = {}): SmcSignal {
  return {
    bias: 'BUY',
    confidence: 0.72,
    bos: false,
    choch: false,
    zones: [],
    swingHigh: 62500,
    swingLow: 61000,
    ...overrides,
  };
}

describe('buildSmcSignalRow', () => {
  it('marks signal_type as CHOCH when choch flag is set (takes precedence over bos)', () => {
    const row = buildSmcSignalRow({
      userId: 'user-1',
      agentId: 'agent-1',
      symbol: 'BTC-USD',
      timeframe: '5M',
      signal: makeSignal({ choch: true, bos: true }),
      price: 62500,
      now: new Date('2026-06-19T15:00:00Z'),
    });
    expect(row.signal_type).toBe('CHOCH');
    expect(row.detected_at).toBe('2026-06-19T15:00:00.000Z');
  });

  it('marks signal_type as BOS when only bos is set', () => {
    const row = buildSmcSignalRow({
      userId: 'user-1', agentId: 'agent-1', symbol: 'ETH-USD', timeframe: '15M',
      signal: makeSignal({ bos: true, choch: false }),
      price: 3400,
    });
    expect(row.signal_type).toBe('BOS');
  });

  it('falls back to BIAS when neither bos nor choch are set', () => {
    const row = buildSmcSignalRow({
      userId: 'user-1', agentId: 'agent-1', symbol: 'SOL-USD', timeframe: '5M',
      signal: makeSignal({ bos: false, choch: false }),
      price: 150,
    });
    expect(row.signal_type).toBe('BIAS');
  });

  it('preserves direction (bias), strength (confidence) and price', () => {
    const row = buildSmcSignalRow({
      userId: 'user-1', agentId: 'agent-1', symbol: 'BTC-USD', timeframe: '5M',
      signal: makeSignal({ bias: 'SELL', confidence: 0.18 }),
      price: 62980.5,
    });
    expect(row.direction).toBe('SELL');
    expect(row.strength).toBe(0.18);
    expect(row.price).toBe(62980.5);
  });

  it('deduplicates zone types in meta', () => {
    const row = buildSmcSignalRow({
      userId: 'user-1', agentId: 'agent-1', symbol: 'BTC-USD', timeframe: '5M',
      signal: makeSignal({
        zones: [
          { type: 'OB', priceLow: 1, priceHigh: 2 } as never,
          { type: 'OB', priceLow: 3, priceHigh: 4 } as never,
          { type: 'FVG', priceLow: 5, priceHigh: 6 } as never,
          { type: 'EQH', priceLow: 7, priceHigh: 8 } as never,
        ],
      }),
      price: 62500,
    });
    expect(row.meta.zones_count).toBe(4);
    expect(row.meta.zone_types.sort()).toEqual(['EQH', 'FVG', 'OB']);
  });

  it('carries swing high/low into meta', () => {
    const row = buildSmcSignalRow({
      userId: 'user-1', agentId: 'agent-1', symbol: 'BTC-USD', timeframe: '5M',
      signal: makeSignal({ swingHigh: 63100, swingLow: 60800 }),
      price: 62500,
    });
    expect(row.meta.swing_high).toBe(63100);
    expect(row.meta.swing_low).toBe(60800);
  });
});

describe('persistSmcSignal', () => {
  it('inserts the row into coinarb_smc_signals and returns ok:true', async () => {
    const captured: { table?: string; row?: unknown } = {};
    const supabase = {
      from: (t: string) => {
        captured.table = t;
        return {
          insert: async (row: unknown) => {
            captured.row = row;
            return { error: null };
          },
        };
      },
    };
    const row = buildSmcSignalRow({
      userId: 'user-1', agentId: 'agent-1', symbol: 'BTC-USD', timeframe: '5M',
      signal: makeSignal(),
      price: 62500,
    });
    const result = await persistSmcSignal(supabase as never, row);
    expect(result.ok).toBe(true);
    expect(captured.table).toBe('coinarb_smc_signals');
    expect((captured.row as { user_id: string }).user_id).toBe('user-1');
  });

  it('surfaces Supabase errors as ok:false with message', async () => {
    const supabase = {
      from: () => ({
        insert: async () => ({ error: { message: 'rls denied' } }),
      }),
    };
    const row = buildSmcSignalRow({
      userId: 'user-1', agentId: 'agent-1', symbol: 'BTC-USD', timeframe: '5M',
      signal: makeSignal(),
      price: 62500,
    });
    const result = await persistSmcSignal(supabase as never, row);
    expect(result).toEqual({ ok: false, error: 'rls denied' });
  });
});
