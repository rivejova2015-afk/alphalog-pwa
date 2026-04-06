/**
 * In-memory position tracker with Supabase sync.
 *
 * Tracks open positions, calculates unrealized P&L,
 * handles position closing logic.
 */

import { getSupabase } from '../supabase.js';

export interface Position {
  id: string;
  agentId: string;
  userId: string;
  marketSlug: string;
  conditionId: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  entryPrice: number;
  sizeUsd: number;
  shares: number;
  leverageUsed: number;
  entryReason: Record<string, unknown>;
  openedAt: number; // epoch ms
}

export interface ClosedPosition extends Position {
  exitPrice: number;
  pnlUsd: number;
  pnlPercent: number;
  exitReason: string;
  closedAt: number;
}

export class PositionTracker {
  private openPositions: Map<string, Position> = new Map();
  private agentId: string;
  private userId: string;

  constructor(agentId: string, userId: string) {
    this.agentId = agentId;
    this.userId = userId;
  }

  get open(): Position[] {
    return Array.from(this.openPositions.values());
  }

  get openCount(): number {
    return this.openPositions.size;
  }

  /**
   * Load open positions from Supabase on startup.
   */
  async loadFromDb(): Promise<void> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('polyarb_positions')
      .select('*')
      .eq('agent_id', this.agentId)
      .eq('status', 'OPEN')
      .is('deleted_at', null);

    if (error) {
      console.error('[position-tracker] Load error:', error.message);
      return;
    }

    for (const row of data ?? []) {
      this.openPositions.set(row.id, {
        id: row.id,
        agentId: row.agent_id,
        userId: row.user_id,
        marketSlug: row.market_slug,
        conditionId: row.condition_id ?? '',
        outcome: row.outcome,
        side: row.side,
        entryPrice: Number(row.entry_price),
        sizeUsd: Number(row.size_usd),
        shares: Number(row.shares),
        leverageUsed: Number(row.leverage_used),
        entryReason: (row.entry_reason ?? {}) as Record<string, unknown>,
        openedAt: new Date(row.opened_at).getTime(),
      });
    }

    console.log(`[position-tracker] Loaded ${this.openPositions.size} open positions`);
  }

  /**
   * Open a new position. Inserts to Supabase and adds to memory.
   */
  async openPosition(params: {
    marketSlug: string;
    conditionId: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    entryPrice: number;
    sizeUsd: number;
    shares: number;
    leverageUsed: number;
    entryReason: Record<string, unknown>;
  }): Promise<Position | null> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('polyarb_positions')
      .insert({
        user_id: this.userId,
        agent_id: this.agentId,
        market_slug: params.marketSlug,
        condition_id: params.conditionId,
        outcome: params.outcome,
        side: params.side,
        status: 'OPEN',
        entry_price: params.entryPrice,
        size_usd: params.sizeUsd,
        shares: params.shares,
        leverage_used: params.leverageUsed,
        entry_reason: params.entryReason,
        opened_at: now,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[position-tracker] Insert error:', error?.message);
      return null;
    }

    const position: Position = {
      id: data.id,
      agentId: this.agentId,
      userId: this.userId,
      ...params,
      openedAt: Date.now(),
    };

    this.openPositions.set(data.id, position);
    return position;
  }

  /**
   * Close a position. Updates Supabase and removes from memory.
   */
  async closePosition(
    positionId: string,
    exitPrice: number,
    exitReason: string
  ): Promise<ClosedPosition | null> {
    const position = this.openPositions.get(positionId);
    if (!position) return null;

    const pnlUsd = (exitPrice - position.entryPrice) * position.shares;
    const pnlPercent = position.entryPrice > 0
      ? ((exitPrice - position.entryPrice) / position.entryPrice) * 100
      : 0;

    const supabase = getSupabase();
    const { error } = await supabase
      .from('polyarb_positions')
      .update({
        status: exitReason === 'circuit_breaker' ? 'LIQUIDATED' : 'CLOSED',
        exit_price: exitPrice,
        pnl_usd: pnlUsd,
        pnl_percent: pnlPercent,
        exit_reason: exitReason,
        closed_at: new Date().toISOString(),
      })
      .eq('id', positionId);

    if (error) {
      console.error('[position-tracker] Close error:', error.message);
      return null;
    }

    this.openPositions.delete(positionId);

    return {
      ...position,
      exitPrice,
      pnlUsd,
      pnlPercent,
      exitReason,
      closedAt: Date.now(),
    };
  }

  /**
   * Close all open positions (circuit breaker liquidation).
   */
  async closeAll(currentPrices: Map<string, number>): Promise<ClosedPosition[]> {
    const results: ClosedPosition[] = [];
    for (const [id, pos] of this.openPositions) {
      const exitPrice = currentPrices.get(pos.conditionId) ?? pos.entryPrice;
      const closed = await this.closePosition(id, exitPrice, 'circuit_breaker');
      if (closed) results.push(closed);
    }
    return results;
  }

  /**
   * Check if any position has exceeded the timeout (5 minutes).
   */
  getTimedOutPositions(timeoutMs: number = 300_000): Position[] {
    const now = Date.now();
    return this.open.filter(p => (now - p.openedAt) > timeoutMs);
  }
}
