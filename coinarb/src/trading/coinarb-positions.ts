/**
 * Cross-venue position tracker for coinarb (spot + perp).
 *
 * Persists to the existing `coinarb_positions` table by mapping:
 *   - market_slug    → `${venue}:${symbol}` (e.g. "spot:BTC-USD", "perp:BTC-PERP")
 *   - condition_id   → broker order_id of the original entry
 *   - outcome        → 'YES' for BUY, 'NO' for SELL (so existing dashboards stay sane)
 *   - entry_reason   → { venue, symbol, leverage, agent='coinarb-50x', ... }
 *
 * No PolyMarket-specific concepts (no slug timestamps, no 5-min window). The
 * loop is responsible for closing on its own signals (e.g. drawdown breaker,
 * cooldown, manual exit).
 */

import { getSupabase } from '../supabase.js';

export type Venue = 'spot' | 'perp';
export type Side = 'BUY' | 'SELL';

export interface CoinarbPosition {
  id: string;                       // Supabase UUID
  agentId: string;
  userId: string;
  venue: Venue;
  symbol: string;                   // 'BTC-USD' | 'ETH-USD' | 'BTC-PERP' | 'ETH-PERP'
  side: Side;
  entryPrice: number;
  sizeUsd: number;
  baseSize: number;                 // contracts (perp) or coins (spot)
  leverageUsed: number;
  entryReason: Record<string, unknown>;
  openedAt: number;
}

export interface ClosedCoinarbPosition extends CoinarbPosition {
  exitPrice: number;
  pnlUsd: number;
  pnlPercent: number;
  exitReason: string;
  closedAt: number;
}

export class CoinarbPositionTracker {
  private readonly open = new Map<string, CoinarbPosition>();

  constructor(private readonly agentId: string, private readonly userId: string) {}

  get count(): number { return this.open.size; }
  list(): CoinarbPosition[] { return Array.from(this.open.values()); }
  forSymbol(venue: Venue, symbol: string): CoinarbPosition[] {
    return this.list().filter(p => p.venue === venue && p.symbol === symbol);
  }

  async loadFromDb(): Promise<void> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('coinarb_positions')
      .select('*')
      .eq('agent_id', this.agentId)
      .eq('status', 'OPEN')
      .is('deleted_at', null);

    if (error) {
      console.error('[coinarb-positions] load error:', error.message);
      return;
    }

    for (const row of data ?? []) {
      const slug = String(row.market_slug ?? '');
      const [venue, ...symbolParts] = slug.split(':');
      if (venue !== 'spot' && venue !== 'perp') continue;
      this.open.set(row.id, {
        id: row.id,
        agentId: row.agent_id,
        userId: row.user_id,
        venue: venue as Venue,
        symbol: symbolParts.join(':'),
        side: row.side === 'BUY' ? 'BUY' : 'SELL',
        entryPrice: Number(row.entry_price),
        sizeUsd: Number(row.size_usd),
        baseSize: Number(row.shares),
        leverageUsed: Number(row.leverage_used ?? 1),
        entryReason: (row.entry_reason ?? {}) as Record<string, unknown>,
        openedAt: new Date(row.opened_at).getTime(),
      });
    }

    console.log(`[coinarb-positions] loaded ${this.open.size} open`);
  }

  async openPosition(params: {
    venue: Venue;
    symbol: string;
    side: Side;
    entryPrice: number;
    sizeUsd: number;
    baseSize: number;
    leverageUsed: number;
    entryReason: Record<string, unknown>;
    brokerOrderId: string;
  }): Promise<CoinarbPosition | null> {
    const supabase = getSupabase();
    const slug = `${params.venue}:${params.symbol}`;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('coinarb_positions')
      .insert({
        user_id: this.userId,
        agent_id: this.agentId,
        market_slug: slug,
        market_question: `${params.venue.toUpperCase()} ${params.symbol}`,
        condition_id: params.brokerOrderId,
        outcome: params.side === 'BUY' ? 'YES' : 'NO',
        side: params.side,
        status: 'OPEN',
        entry_price: params.entryPrice,
        size_usd: params.sizeUsd,
        shares: params.baseSize,
        leverage_used: params.leverageUsed,
        entry_reason: { ...params.entryReason, venue: params.venue, symbol: params.symbol },
        opened_at: now,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[coinarb-positions] insert error:', error?.message);
      return null;
    }

    const pos: CoinarbPosition = {
      id: data.id,
      agentId: this.agentId,
      userId: this.userId,
      venue: params.venue,
      symbol: params.symbol,
      side: params.side,
      entryPrice: params.entryPrice,
      sizeUsd: params.sizeUsd,
      baseSize: params.baseSize,
      leverageUsed: params.leverageUsed,
      entryReason: params.entryReason,
      openedAt: Date.now(),
    };

    this.open.set(data.id, pos);
    return pos;
  }

  async closePosition(
    id: string,
    exitPrice: number,
    exitReason: string,
    extras: {
      feeUsd?: number;
      slippageBps?: number;
      executionLatencyMs?: number;
    } = {},
  ): Promise<ClosedCoinarbPosition | null> {
    const pos = this.open.get(id);
    if (!pos) return null;

    this.open.delete(id);

    const grossPnl = pos.side === 'BUY'
      ? (exitPrice - pos.entryPrice) * pos.baseSize
      : (pos.entryPrice - exitPrice) * pos.baseSize;
    const feeUsd = Math.max(0, extras.feeUsd ?? 0);
    const pnlUsd = grossPnl - feeUsd;
    const pnlPercent = pos.entryPrice > 0
      ? (pnlUsd / pos.sizeUsd) * 100
      : 0;

    const supabase = getSupabase();
    const closedAt = new Date().toISOString();

    const { error } = await supabase
      .from('coinarb_positions')
      .update({
        status: exitReason === 'circuit_breaker' ? 'LIQUIDATED' : 'CLOSED',
        exit_price: exitPrice,
        pnl_usd: pnlUsd,
        pnl_percent: pnlPercent,
        exit_reason: exitReason,
        closed_at: closedAt,
      })
      .eq('id', id)
      .eq('status', 'OPEN');

    if (error) {
      console.error('[coinarb-positions] close error:', error.message);
      return null;
    }

    const { error: tradeError } = await supabase.from('coinarb_trades').insert({
      user_id: pos.userId,
      agent_id: pos.agentId,
      position_id: id,
      market_slug: `${pos.venue}:${pos.symbol}`,
      condition_id: '',
      outcome: pos.side === 'BUY' ? 'YES' : 'NO',
      side: pos.side === 'BUY' ? 'SELL' : 'BUY',
      price: exitPrice,
      size: pos.baseSize,
      size_usd: pos.sizeUsd,
      fee_usd: feeUsd,
      pnl_usd: pnlUsd,
      slippage_bps: extras.slippageBps ?? null,
      execution_latency_ms: extras.executionLatencyMs ?? null,
      trade_type: 'EXIT',
      status: 'FILLED',
      executed_at: closedAt,
    });
    if (tradeError) console.warn('[coinarb-positions] EXIT trade insert:', tradeError.message);

    return { ...pos, exitPrice, pnlUsd, pnlPercent, exitReason, closedAt: Date.now() };
  }

  async closeAll(
    currentPrices: Map<string, number>,
    reason: string,
    feeOf?: (pos: CoinarbPosition, exitPrice: number) => number,
  ): Promise<ClosedCoinarbPosition[]> {
    const closed: ClosedCoinarbPosition[] = [];
    for (const [id, pos] of this.open) {
      const px = currentPrices.get(`${pos.venue}:${pos.symbol}`) ?? pos.entryPrice;
      const feeUsd = feeOf ? feeOf(pos, px) : 0;
      const r = await this.closePosition(id, px, reason, { feeUsd });
      if (r) closed.push(r);
    }
    return closed;
  }
}
