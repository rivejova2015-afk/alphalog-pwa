/**
 * B3 — Session Clock Engine
 *
 * Not all hours are equal. BTC 5-min binary markets during the NY open (12-16 UTC)
 * behave very differently from the Asian session (0-6 UTC).
 *
 * This engine loads historical win rates from polyarb_positions by session bucket
 * and votes accordingly: favorable session → amplify signal, unfavorable → caution.
 */

import { getSupabase } from '../supabase.js';

export type TradingSession = 'ASIA' | 'LONDON' | 'NY_OPEN' | 'NY_CLOSE' | 'OVERNIGHT';

export interface SessionSignal {
  session: TradingSession;
  utcHour: number;
  sessionWinRate: number;
  sampleCount: number;
  signal: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL';
  confidence: number; // 0-1, higher with more samples
}

const SESSION_BOUNDARIES: Array<{ name: TradingSession; startHour: number; endHour: number }> = [
  { name: 'ASIA',       startHour:  0, endHour:  6 },
  { name: 'LONDON',     startHour:  7, endHour: 11 },
  { name: 'NY_OPEN',    startHour: 12, endHour: 16 },
  { name: 'NY_CLOSE',   startHour: 17, endHour: 20 },
  { name: 'OVERNIGHT',  startHour: 21, endHour: 23 },
];

const FAVORABLE_WIN_RATE   = 0.60;
const UNFAVORABLE_WIN_RATE = 0.40;
const MIN_SAMPLES_TO_VOTE  = 3;

function currentSession(): { session: TradingSession; utcHour: number } {
  const utcHour = new Date().getUTCHours();
  for (const s of SESSION_BOUNDARIES) {
    if (utcHour >= s.startHour && utcHour <= s.endHour) {
      return { session: s.name, utcHour };
    }
  }
  return { session: 'OVERNIGHT', utcHour };
}

export class SessionClock {
  private cache: Map<string, { winRate: number; sampleCount: number; loadedAt: number }> = new Map();
  private readonly TTL_MS = 10 * 60_000; // refresh every 10 min

  async getSignal(symbol: string): Promise<SessionSignal> {
    const { session, utcHour } = currentSession();
    const cacheKey = `${symbol}:${session}`;
    const cached = this.cache.get(cacheKey);

    if (!cached || Date.now() - cached.loadedAt > this.TTL_MS) {
      await this.load(symbol, session, cacheKey);
    }

    const stats = this.cache.get(cacheKey);
    const winRate = stats?.winRate ?? 0.5;
    const sampleCount = stats?.sampleCount ?? 0;

    if (sampleCount < MIN_SAMPLES_TO_VOTE) {
      return { session, utcHour, sessionWinRate: 0.5, sampleCount, signal: 'NEUTRAL', confidence: 0 };
    }

    const confidence = Math.min(1, sampleCount / 20);

    let signal: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL' = 'NEUTRAL';
    if (winRate > FAVORABLE_WIN_RATE)   signal = 'FAVORABLE';
    if (winRate < UNFAVORABLE_WIN_RATE) signal = 'UNFAVORABLE';

    return { session, utcHour, sessionWinRate: winRate, sampleCount, signal, confidence };
  }

  private async load(symbol: string, session: TradingSession, cacheKey: string): Promise<void> {
    try {
      const supabase = getSupabase();
      const bounds = SESSION_BOUNDARIES.find(s => s.name === session);
      if (!bounds) return;

      // Fetch closed BTC/ETH positions and check win rate by session hour
      const { data } = await supabase
        .from('polyarb_positions')
        .select('outcome, pnl_usd, opened_at')
        .eq('status', 'CLOSED')
        .ilike('market_slug', `${symbol.toLowerCase()}-updown-5m-%`)
        .not('pnl_usd', 'is', null);

      if (!data) return;

      const sessionTrades = data.filter(t => {
        if (!t.opened_at) return false;
        const h = new Date(t.opened_at).getUTCHours();
        return h >= bounds.startHour && h <= bounds.endHour;
      });

      const wins  = sessionTrades.filter(t => (t.pnl_usd ?? 0) > 0).length;
      const total = sessionTrades.length;
      const winRate = total > 0 ? wins / total : 0.5;

      this.cache.set(cacheKey, { winRate, sampleCount: total, loadedAt: Date.now() });
    } catch {
      // Keep stale cache or defaults
    }
  }
}
