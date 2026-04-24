/**
 * Settlement Engine — detecta resolución de mercados, registra P&L real,
 * y ejecuta redemption automático via CLOB API (sin MATIC).
 *
 * Flujo completo tras expirar una posición:
 *  1. Espera 30s para que gamma API registre la resolución
 *  2. Consulta gamma API → outcomePrices determina ganador
 *  3. Calcula P&L real (shares − sizeUsd si ganó, −sizeUsd si perdió)
 *  4. Si ganó → llama CLOB /redeem-positions para acreditar USDC automáticamente
 *  5. Actualiza polyarb_positions y polyarb_trades en Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderManager } from '../trading/order-manager.js';
import type { Position } from '../trading/position-tracker.js';
import { clobFetch } from '../lib/clob-fetch.js';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

interface GammaMarket {
  outcomePrices: string;  // JSON string: '["1","0"]'
  closed: boolean;
  clobTokenIds: string;   // JSON string: '["YES_TOKEN_ID","NO_TOKEN_ID"]'
  conditionId: string;
}

interface GammaEvent {
  markets?: GammaMarket[];
}

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
 * outcomePrices: JSON string like '["1","0"]' or '["0.52","0.48"]'
 * Market resolved when any price > 0.9 or < 0.05.
 * btc-updown-5m: index 0 = Up = YES, index 1 = Down = NO.
 */
export function parseWinner(outcomePrices: string, outcome: 'YES' | 'NO'): boolean | null {
  let prices: string[];
  try {
    prices = JSON.parse(outcomePrices) as string[];
  } catch {
    return null;
  }
  if (prices.length < 2) return null;

  const resolved = prices.some(p => parseFloat(p) > 0.9 || parseFloat(p) < 0.05);
  if (!resolved) return null;

  const idx = outcome === 'YES' ? 0 : 1;
  return parseFloat(prices[idx]) > 0.5;
}

function calcPnl(won: boolean, shares: number, sizeUsd: number): number {
  return won ? (shares - sizeUsd) : -sizeUsd;
}

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

// ─── Redemption via CLOB API ──────────────────────────────────────────────────

/**
 * Trigger gasless redemption via Polymarket CLOB API.
 * The CLOB acts as a relayer — no MATIC needed from the user.
 *
 * Flow: winning token → CLOB processes on-chain redemption → USDC credited to balance.
 */
async function triggerClobRedemption(
  orderManager: OrderManager,
  market: GammaMarket,
  outcome: 'YES' | 'NO',
  shares: number,
): Promise<void> {
  try {
    let tokenIds: string[];
    try {
      tokenIds = JSON.parse(market.clobTokenIds) as string[];
    } catch {
      console.warn('[settlement] clobTokenIds parse failed — skipping redemption');
      return;
    }

    // index 0 = YES/Up token, index 1 = NO/Down token
    const tokenId = outcome === 'YES' ? tokenIds[0] : tokenIds[1];
    if (!tokenId) {
      console.warn('[settlement] tokenId not found — skipping redemption');
      return;
    }

    // Polymarket uses 1e6 base units (USDC decimals on Polygon)
    // shares × $1/share × 1e6 micro-USDC/USDC
    const amountMicro = Math.round(shares * 1e6).toString();

    await orderManager.redeemWinningPosition(tokenId, amountMicro);
    console.log(`[settlement] Redemption triggered: ${shares.toFixed(4)} shares → $${shares.toFixed(4)} USDC (token ${tokenId.slice(0, 12)}...)`);
  } catch (err) {
    // Redemption failure is non-fatal: P&L is already recorded, CLOB may auto-settle
    console.warn('[settlement] Redemption call failed (non-fatal):', err instanceof Error ? err.message : String(err));
  }
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

  // Trigger CLOB redemption if won — acredita USDC automáticamente al balance
  if (won && market) {
    await triggerClobRedemption(orderManager, market, position.outcome, position.shares);
  }
}

export function settleTimedOutPosition(
  position: Position,
  orderManager: OrderManager,
  supabase: SupabaseClient,
): void {
  // 30s delay para que gamma API registre la resolución
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
  redeemed?: boolean;
}

interface DbPosition {
  id: string;
  market_slug: string;
  condition_id: string | null;
  outcome: 'YES' | 'NO';
  shares: number | string;
  size_usd: number | string;
  exit_reason: string | null;
}

export async function sweepUnsettledPositions(
  supabase: SupabaseClient,
  orderManager?: OrderManager,
): Promise<SweepResult[]> {
  const { data, error } = await supabase
    .from('polyarb_positions')
    .select('id, market_slug, condition_id, outcome, shares, size_usd, exit_reason')
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

      // Trigger CLOB redemption automáticamente si ganó
      let redeemed = false;
      if (won && orderManager) {
        try {
          await triggerClobRedemption(orderManager, market, pos.outcome, shares);
          redeemed = true;
        } catch {
          // non-fatal
        }
      }

      results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won, pnlUsd, skipped: false, reason: won ? 'settled_win' : 'settled_loss', redeemed });
      console.log(`[settlement] sweep: ${pos.market_slug} → ${won ? 'GANÓ' : 'PERDIÓ'} pnl=$${pnlUsd.toFixed(4)}${redeemed ? ' [redeemed]' : ''}`);
    } catch (err) {
      results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: `error: ${err instanceof Error ? err.message : String(err)}` });
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`[settlement] Sweep completado: ${results.filter(r => !r.skipped).length} liquidadas`);
  return results;
}
