/**
 * Settlement Engine — detecta resolución de mercados, registra P&L real,
 * y ejecuta on-chain redemption via CtfRedeemer (requiere MATIC para gas).
 *
 * Flujo tras expirar una posición:
 *  1. Espera 30s para que gamma API registre la resolución
 *  2. Consulta gamma API → outcomePrices determina ganador
 *  3. Calcula P&L real (shares − sizeUsd si ganó, −sizeUsd si perdió)
 *  4. Si ganó → CtfRedeemer.redeemNegRisk() → USDC a wallet on-chain
 *  5. Actualiza polyarb_positions y polyarb_trades en Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Position } from '../trading/position-tracker.js';
import type { CtfRedeemer } from '../trading/ctf-redeemer.js';
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

// ─── Modo tiempo real — posición recién expirada ──────────────────────────────

async function settleWithRetry(
  position: Position,
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
    setTimeout(() => void settleWithRetry(position, supabase, attempt + 1, maxAttempts), 30_000);
    return;
  }

  const pnlUsd = calcPnl(won, position.shares, position.sizeUsd);
  await persistSettlement(supabase, position.id, pnlUsd, won ? 'settled_win' : 'settled_loss', won ? 1 : 0);
  console.log(`[settlement] ${position.marketSlug} → ${won ? 'GANÓ (+$' + pnlUsd.toFixed(4) + ')' : 'PERDIÓ (-$' + Math.abs(pnlUsd).toFixed(4) + ')'} [Polymarket auto-liquida el USDC al balance CLOB]`);
}

export function settleTimedOutPosition(
  position: Position,
  supabase: SupabaseClient,
): void {
  // 30s delay para que gamma API registre la resolución
  setTimeout(
    () => settleWithRetry(position, supabase).catch(err =>
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
  condition_id: string | null;
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

      results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won, pnlUsd, skipped: false, reason: won ? 'settled_win' : 'settled_loss' });
      console.log(`[settlement] sweep: ${pos.market_slug} → ${won ? 'GANÓ' : 'PERDIÓ'} pnl=$${pnlUsd.toFixed(4)}`);
    } catch (err) {
      results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: `error: ${err instanceof Error ? err.message : String(err)}` });
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`[settlement] Sweep completado: ${results.filter(r => !r.skipped).length} liquidadas`);
  return results;
}

// ─── On-chain redemption de wins ya liquidadas en DB ─────────────────────────

/**
 * Busca posiciones settled_win con redeemed=false y llama CtfRedeemer
 * para redimir los tokens on-chain en Polygon (requiere MATIC para gas).
 *
 * Para NegRisk (btc-updown-5m): llama NegRiskAdapter.redeemPositions().
 * Los clobTokenIds (YES/NO token IDs) se obtienen via gamma API.
 */
export async function redeemPendingWins(
  supabase: SupabaseClient,
  redeemer: CtfRedeemer,
): Promise<void> {
  if (!redeemer.walletAddress) {
    console.log('[settlement] redeemPendingWins: sin wallet — se omite on-chain redemption');
    return;
  }

  const { data, error } = await supabase
    .from('polyarb_positions')
    .select('id, market_slug, condition_id, outcome')
    .eq('exit_reason', 'settled_win')
    .eq('redeemed', false)
    .limit(50);

  if (error || !data || data.length === 0) {
    if (!error) console.log('[settlement] redeemPendingWins: sin wins pendientes de redimir');
    return;
  }

  console.log(`[settlement] redeemPendingWins: ${data.length} wins sin redimir en wallet ${redeemer.walletAddress}`);

  for (const pos of data as Array<{ id: string; market_slug: string; condition_id: string | null; outcome: 'YES' | 'NO' }>) {
    if (!pos.condition_id) {
      console.warn(`[settlement] redeemPendingWins: sin conditionId para ${pos.market_slug}`);
      continue;
    }

    try {
      const market = await fetchGammaMarket(pos.market_slug);
      if (!market?.clobTokenIds) {
        console.warn(`[settlement] redeemPendingWins: sin clobTokenIds para ${pos.market_slug}`);
        continue;
      }

      let tokenIds: string[];
      try {
        tokenIds = JSON.parse(market.clobTokenIds) as string[];
      } catch {
        console.warn(`[settlement] redeemPendingWins: clobTokenIds parse error ${pos.market_slug}`);
        continue;
      }

      // clobTokenIds: [YES_token_id, NO_token_id] — pick based on outcome
      const tokenId = pos.outcome === 'YES' ? tokenIds[0] : tokenIds[1];
      if (!tokenId) {
        console.warn(`[settlement] redeemPendingWins: tokenId incompleto ${pos.market_slug} outcome=${pos.outcome}`);
        continue;
      }

      const result = await redeemer.redeemPosition({
        conditionId: pos.condition_id,
        outcome: pos.outcome,
        tokenId,
        positionId: pos.id,
      });

      if (result.redeemed) {
        console.log(`[settlement] redeemPendingWins: ${pos.market_slug} ✓ $${result.amountUsd.toFixed(4)} USDC${result.txHash ? ` tx=${result.txHash.slice(0, 16)}...` : ''}`);
      } else {
        console.warn(`[settlement] redeemPendingWins: ${pos.market_slug} falló — ${result.error}`);
      }
    } catch (err) {
      console.warn(`[settlement] redeemPendingWins error ${pos.market_slug}:`, err instanceof Error ? err.message : String(err));
    }

    await new Promise(r => setTimeout(r, 1_000));
  }
}
