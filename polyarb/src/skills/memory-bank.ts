/**
 * Memory Bank — Superpower #2
 *
 * The agent records every signal it generates and learns from outcomes.
 * Over time it builds conditional win rates by:
 *   - Symbol (BTC / ETH / SOL)
 *   - Regime (CALM / TRENDING / VOLATILE / CRISIS)
 *   - Distance zone (0-5% / 5-10% / 10-15% from milestone)
 *   - Velocity window alignment (5m+1h both up/down vs mixed)
 *   - Hunt strength bucket (0-30 / 30-60 / 60-100)
 *
 * This knowledge filters future signals: conditions with <40% historical
 * win rate are down-weighted or skipped.
 */

import { getSupabase } from '../supabase.js';
import type { VelocitySignal } from './velocity-detector.js';
import type { MarketRegime } from './regime-detector.js';

export interface MemoryEntry {
  id: string;
  agentId: string;
  userId: string;
  conditionId: string;
  symbol: string;
  regime: MarketRegime;
  distanceZone: 'CLOSE' | 'MID' | 'FAR';      // <5% / 5-10% / 10-15%
  velocityAlignment: 'ALIGNED' | 'MIXED';       // 5m+1h same direction or not
  huntStrengthBucket: 'WEAK' | 'MID' | 'STRONG'; // 0-30 / 30-60 / 60-100
  edgeAtEntry: number;
  enteredAt: number;
  outcome: 'WIN' | 'LOSS' | 'TIMEOUT' | null; // null = pending
  pnlUsd: number | null;
  closedAt: number | null;
}

// Condition key → win/total stats
type ConditionStats = Map<string, { wins: number; total: number }>;

export class MemoryBank {
  private pending: Map<string, MemoryEntry> = new Map(); // positionId → entry
  private stats: ConditionStats = new Map();
  private agentId: string;
  private userId: string;

  constructor(agentId: string, userId: string) {
    this.agentId = agentId;
    this.userId = userId;
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  /**
   * Record a new signal/entry. Called when a position opens.
   */
  recordEntry(
    positionId: string,
    signal: VelocitySignal,
    regime: MarketRegime,
    edge: number,
  ): void {
    const w5m = signal.windows.find(w => w.label === '5m');
    const w1h = signal.windows.find(w => w.label === '1h');
    const aligned =
      w5m && w1h &&
      ((w5m.velocity > 0 && w1h.velocity > 0) || (w5m.velocity < 0 && w1h.velocity < 0));

    const distPct = signal.milestone?.distancePct ?? 100;
    const distanceZone: MemoryEntry['distanceZone'] =
      distPct < 5 ? 'CLOSE' : distPct < 10 ? 'MID' : 'FAR';

    const huntBucket: MemoryEntry['huntStrengthBucket'] =
      signal.huntStrength < 30 ? 'WEAK' : signal.huntStrength < 60 ? 'MID' : 'STRONG';

    const entry: MemoryEntry = {
      id: positionId,
      agentId: this.agentId,
      userId: this.userId,
      conditionId: signal.conditionId,
      symbol: signal.symbol,
      regime,
      distanceZone,
      velocityAlignment: aligned ? 'ALIGNED' : 'MIXED',
      huntStrengthBucket: huntBucket,
      edgeAtEntry: edge,
      enteredAt: Date.now(),
      outcome: null,
      pnlUsd: null,
      closedAt: null,
    };

    this.pending.set(positionId, entry);
  }

  /**
   * Record outcome when a position closes. Called from position tracker.
   */
  async recordOutcome(
    positionId: string,
    pnlUsd: number,
  ): Promise<void> {
    const entry = this.pending.get(positionId);
    if (!entry) return;

    entry.outcome = pnlUsd > 0 ? 'WIN' : 'LOSS';
    entry.pnlUsd = pnlUsd;
    entry.closedAt = Date.now();

    // Update in-memory stats
    const key = this.conditionKey(entry);
    const current = this.stats.get(key) ?? { wins: 0, total: 0 };
    current.total++;
    if (entry.outcome === 'WIN') current.wins++;
    this.stats.set(key, current);

    // Persist to Supabase
    void this.persist(entry);

    this.pending.delete(positionId);
  }

  // ── Querying ──────────────────────────────────────────────────────────────

  /**
   * Get the historical win rate for a set of conditions.
   * Returns null if not enough data.
   */
  getWinRate(
    symbol: string,
    regime: MarketRegime,
    distanceZone: MemoryEntry['distanceZone'],
    alignment: MemoryEntry['velocityAlignment'],
    huntBucket: MemoryEntry['huntStrengthBucket'],
  ): { winRate: number; total: number } | null {
    const key = `${symbol}|${regime}|${distanceZone}|${alignment}|${huntBucket}`;
    const stats = this.stats.get(key);
    if (!stats || stats.total < 3) return null; // Not enough data
    return { winRate: stats.wins / stats.total, total: stats.total };
  }

  /**
   * Should the agent filter this signal based on memory?
   * Returns true if historical win rate is too low (<40%) with enough data.
   */
  shouldFilter(
    signal: VelocitySignal,
    regime: MarketRegime,
  ): { filter: boolean; reason: string | null } {
    const w5m = signal.windows.find(w => w.label === '5m');
    const w1h = signal.windows.find(w => w.label === '1h');
    const aligned =
      w5m && w1h &&
      ((w5m.velocity > 0 && w1h.velocity > 0) || (w5m.velocity < 0 && w1h.velocity < 0));

    const distPct = signal.milestone?.distancePct ?? 100;
    const distanceZone: MemoryEntry['distanceZone'] =
      distPct < 5 ? 'CLOSE' : distPct < 10 ? 'MID' : 'FAR';

    const huntBucket: MemoryEntry['huntStrengthBucket'] =
      signal.huntStrength < 30 ? 'WEAK' : signal.huntStrength < 60 ? 'MID' : 'STRONG';

    const historical = this.getWinRate(
      signal.symbol,
      regime,
      distanceZone,
      aligned ? 'ALIGNED' : 'MIXED',
      huntBucket,
    );

    if (!historical) return { filter: false, reason: null };
    if (historical.winRate < 0.40) {
      return {
        filter: true,
        reason: `Memory: ${signal.symbol} ${distanceZone} ${regime} wins only ${(historical.winRate * 100).toFixed(0)}% (n=${historical.total})`,
      };
    }

    return { filter: false, reason: null };
  }

  /**
   * Get all accumulated stats for telemetry/dashboard.
   */
  getStats(): Array<{ key: string; wins: number; total: number; winRate: number }> {
    return Array.from(this.stats.entries()).map(([key, s]) => ({
      key,
      wins: s.wins,
      total: s.total,
      winRate: s.wins / s.total,
    }));
  }

  /**
   * Load historical outcomes from Supabase at startup.
   */
  async loadFromDb(): Promise<void> {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('polyarb_signal_memory')
        .select('symbol, regime, distance_zone, velocity_alignment, hunt_bucket, outcome')
        .eq('agent_id', this.agentId)
        .not('outcome', 'is', null)
        .order('closed_at', { ascending: false })
        .limit(500);

      if (!data) return;

      for (const row of data) {
        const key = `${row.symbol}|${row.regime}|${row.distance_zone}|${row.velocity_alignment}|${row.hunt_bucket}`;
        const current = this.stats.get(key) ?? { wins: 0, total: 0 };
        current.total++;
        if (row.outcome === 'WIN') current.wins++;
        this.stats.set(key, current);
      }

      console.log(`[memory-bank] Loaded ${data.length} historical signals`);
    } catch (err) {
      console.error('[memory-bank] Failed to load from DB:', err);
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private conditionKey(entry: MemoryEntry): string {
    return `${entry.symbol}|${entry.regime}|${entry.distanceZone}|${entry.velocityAlignment}|${entry.huntStrengthBucket}`;
  }

  private async persist(entry: MemoryEntry): Promise<void> {
    try {
      const supabase = getSupabase();
      await supabase.from('polyarb_signal_memory').insert({
        id: entry.id,
        agent_id: entry.agentId,
        user_id: entry.userId,
        condition_id: entry.conditionId,
        symbol: entry.symbol,
        regime: entry.regime,
        distance_zone: entry.distanceZone,
        velocity_alignment: entry.velocityAlignment,
        hunt_bucket: entry.huntStrengthBucket,
        edge_at_entry: entry.edgeAtEntry,
        entered_at: new Date(entry.enteredAt).toISOString(),
        outcome: entry.outcome,
        pnl_usd: entry.pnlUsd,
        closed_at: entry.closedAt ? new Date(entry.closedAt).toISOString() : null,
      });
    } catch (err) {
      console.error('[memory-bank] Persist error:', err);
    }
  }
}
