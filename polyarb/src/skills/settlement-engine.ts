/**
 * Settlement Engine — detecta resolución de mercados y registra P&L real.
 *
 * La gamma API devuelve `outcomePrices` (NO un campo `winner`):
 *   outcomePrices[0] = precio de YES/Up  (1.0 = ganó, 0.0 = perdió)
 *   outcomePrices[1] = precio de NO/Down
 *
 * Para btc-updown-5m: YES = Up (índice 0), NO = Down (índice 1).
 *
 * P&L real:
 *   Ganó → shares - sizeUsd  (cada share paga $1, se descuenta lo invertido)
 *   Perdió → -sizeUsd
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderManager } from '../trading/order-manager.js';
import type { Position } from '../trading/position-tracker.js';
import { clobFetch } from '../lib/clob-fetch.js';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

interface GammaMarket {
  outcomePrices: string; // JSON string: '["1","0"]'
  closed: boolean;
}

interface GammaEvent {
  markets?: GammaMarket[];
}

/** Fetch the market data from gamma API using the market slug. */
async function fetchGammaMarket(marketSlug: string): Promise<GammaMarket | null> {
  try {
    const url = `${GAMMA_BASE}/events?slug=${encodeURIComponent(marketSlug)}`;
    const res = await clobFetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const events = await res.json() as GammaEvent[];
    return events[0]?.markets?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Parse outcomePrices to determine if the given outcome won.
 * Returns true (won), false (lost), or null (not yet resolved).
 *
 * outcomePrices is a JSON-serialised string like '["1","0"]' or '["0.52","0.48"]'.
 * A market is resolved when one price reaches > 0.9 (Polymarket settles to 0 or 1).
 */
export function parseWinner(outcomePrices: string, outcome: 'YES' | 'NO'): boolean | null {
  let prices: string[];
  try {
    prices = JSON.parse(outcomePrices) as string[];
  } catch {
    return null;
  }
  if (prices.length < 2) return null;

  // Market is resolved when any price is near 0 or 1
  const resolved = prices.some(p => parseFloat(p) > 0.9 || parseFloat(p) < 0.05);
  if (!resolved) return null;

  // btc-updown-5m: index 0 = Up = YES, index 1 = Down = NO
  const idx = outcome === 'YES' ? 0 : 1;
  return parseFloat(prices[idx]) > 0.5;
}

/** Real P&L calculation. */
function calcPnl(won: boolean, shares: number, sizeUsd: number): number {
  return won ? (shares - sizeUsd) : -sizeUsd;
}

/** Write confirmed P&L to polyarb_positions and the EXIT trade record. */
async function persistSettlement(
  supabase: SupabaseClient,
  positionId: string,
  pnlUsd: number,
  exitReason: 'settled_win' | 'settled_loss',
  exitPrice: 1 | 0,
): Promise<void> {
  await supabase
    .from('polyarb_positions')
    .update({ pnl_usd: pnlUsd, exit_reason: exitReason, exit_price: exitPrice })
    .eq('id', positionId);

  await supabase
    .from('polyarb_trades')
    .update({ pnl_usd: pnlUsd })
    .eq('position_id', positionId)
    .eq('trade_type', 'EXIT');
}

// ─── Modo tiempo real — posición recién expirada ──────────────────────────────

async function settleWithRetry(
  position: Position,
  orderManager: OrderManager,
  supabase: SupabaseClient,
  attempt = 1,
  maxAttempts = 8,
): Promise<void> {
  const market = await fetchGammaMarket(position.marketSlug);
  const won = market ? parseWinner(market.outcomePrices, position.outcome) : null;

  if (won === null) {
    if (attempt >= maxAttempts) {
      console.warn(`[settlement] Max retries para ${position.marketSlug} — registrando pérdida`);
      await persistSettlement(supabase, position.id, -position.sizeUsd, 'settled_loss', 0);
      return;
    }
    console.log(`[settlement] ${position.marketSlug} no resolvió aún (intento ${attempt}/${maxAttempts})`);
    setTimeout(() => void settleWithRetry(position, orderManager, supabase, attempt + 1, maxAttempts), 30_000);
    return;
  }

  const pnlUsd = calcPnl(won, position.shares, position.sizeUsd);
  await persistSettlement(supabase, position.id, pnlUsd, won ? 'settled_win' : 'settled_loss', won ? 1 : 0);
  console.log(`[settlement] ${position.marketSlug} → ${won ? 'GANÓ' : 'PERDIÓ'} pnl=$${pnlUsd.toFixed(4)}`);
}

export function settleTimedOutPosition(
  position: Position,
  orderManager: OrderManager,
  supabase: SupabaseClient,
): void {
  // 30s de espera para que gamma API registre la resolución
  setTimeout(
    () => settleWithRetry(position, orderManager, supabase).catch(err =>
      console.error('[settlement] Error:', err instanceof Error ? err.message : String(err))
    ),
    30_000,
  );
}

// ─── Sweep al arrancar — liquida posiciones pasadas ───────────────────────────

export interface SweepResult {
  positionId: string;
  marketSlug: string;
  outcome: string;
  won: boolean | null;
  pnlUsd: number;
  skipped: boolean;
  reason: string;
}

interface DbPosition {
  id: string;
  market_slug: string;
  outcome: 'YES' | 'NO';
  shares: number | string;
  size_usd: number | string;
  exit_reason: string | null;
}

export async function sweepUnsettledPositions(
  supabase: SupabaseClient,
): Promise<SweepResult[]> {
  const { data, error } = await supabase
    .from('polyarb_positions')
    .select('id, market_slug, outcome, shares, size_usd, exit_reason')
    .in('status', ['CLOSED', 'LIQUIDATED'])
    .not('exit_reason', 'in', '("settled_win","settled_loss","settlement_timeout")')
    .limit(200);

  if (error) {
    console.error('[settlement] sweep query error:', error.message);
    return [];
  }

  const positions = (data ?? []) as DbPosition[];
  if (positions.length === 0) {
    console.log('[settlement] Sweep: sin posiciones pendientes');
    return [];
  }

  console.log(`[settlement] Sweep: procesando ${positions.length} posiciones...`);
  const results: SweepResult[] = [];

  for (const pos of positions) {
    const shares = Number(pos.shares);
    const sizeUsd = Number(pos.size_usd);

    try {
      const market = await fetchGammaMarket(pos.market_slug);

      if (!market) {
        results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: 'gamma_unavailable' });
        continue;
      }

      const won = parseWinner(market.outcomePrices, pos.outcome);

      if (won === null) {
        results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: 'not_resolved_yet' });
        continue;
      }

      const pnlUsd = calcPnl(won, shares, sizeUsd);
      await persistSettlement(supabase, pos.id, pnlUsd, won ? 'settled_win' : 'settled_loss', won ? 1 : 0);
      results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won, pnlUsd, skipped: false, reason: won ? 'settled_win' : 'settled_loss' });
      console.log(`[settlement] sweep: ${pos.market_slug} → ${won ? 'GANÓ' : 'PERDIÓ'} pnl=$${pnlUsd.toFixed(4)}`);
    } catch (err) {
      results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: `error: ${err instanceof Error ? err.message : String(err)}` });
    }

    // Throttle: evitar rate limit en gamma API
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`[settlement] Sweep completado: ${results.filter(r => !r.skipped).length} liquidadas`);
  return results;
}
