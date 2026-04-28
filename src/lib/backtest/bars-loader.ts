import type { SupabaseClient } from '@supabase/supabase-js';
import type { Bar, Timeframe } from '@/types/backtest';

const PAGE = 1000;

export async function loadHistoricalBars(
  supabase: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<Bar[]> {
  const out: Bar[] = [];
  let cursor = from;
  for (let page = 0; page < 200; page++) {
    const { data, error } = await supabase
      .from('historical_bars')
      .select('ts, open, high, low, close, volume, spread')
      .eq('symbol', symbol)
      .eq('timeframe', timeframe)
      .gte('ts', cursor)
      .lte('ts', to)
      .order('ts', { ascending: true })
      .limit(PAGE);
    if (error) throw new Error(`bars load failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      out.push({
        ts: r.ts,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume),
        spread: r.spread != null ? Number(r.spread) : null,
      });
    }
    if (data.length < PAGE) break;
    cursor = data[data.length - 1].ts;
  }
  return out;
}
