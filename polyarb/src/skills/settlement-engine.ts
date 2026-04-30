/**
 * Settlement Engine — detecta resolución de mercados, registra P&L real,
 * y ejecuta on-chain redemption via CtfRedeemer (requiere MATIC para gas).
 *
 * Flujo tras expirar una posición:
 *  1. Espera 30s para que gamma API registre la resolución
 *  2. Consulta CLOB API por conditionId (más fiable que slug en eventos pasados)
 *     Fallback: Gamma API por slug
 *  3. Calcula P&L real (shares − sizeUsd si ganó, −sizeUsd si perdió)
 *  4. Si ganó → CtfRedeemer.redeemNegRisk() → USDC a wallet on-chain
 *  5. Actualiza polyarb_positions y polyarb_trades en Supabase
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Position } from '../trading/position-tracker.js';
import type { CtfRedeemer } from '../trading/ctf-redeemer.js';
import { clobFetch } from '../lib/clob-fetch.js';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CLOB_BASE  = 'https://clob.polymarket.com';

// ─── Zod schemas — catch API shape changes before they corrupt data ────────────

const ClobMarketSchema = z.object({
  condition_id: z.string(),
  closed: z.boolean(),
  tokens: z.array(z.object({
    outcome: z.string(),
    price:   z.union([z.string(), z.number()]).transform(v => String(v)),
  })).min(2),
});

const GammaMarketSchema = z.object({
  outcomePrices: z.string(),
  closed:        z.boolean(),
  clobTokenIds:  z.string().default('[]'),
  conditionId:   z.string().optional(),
});

const GammaEventSchema = z.object({
  markets: z.array(GammaMarketSchema).optional(),
});

// ─── Internal shape ────────────────────────────────────────────────────────────

interface GammaMarket {
  outcomePrices: string;
  closed: boolean;
  clobTokenIds: string;
  conditionId: string;
}

/**
 * Primary: CLOB API by conditionId — works for past and active markets.
 * Maps token outcomes to outcomePrices format: index 0 = YES (Up), index 1 = NO (Down).
 */
async function fetchByClobConditionId(conditionId: string): Promise<GammaMarket | null> {
  try {
    const url = `${CLOB_BASE}/markets/${conditionId}`;
    const res = await clobFetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const raw = await res.json();
    const parsed = ClobMarketSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn('[settlement] CLOB API shape inesperado:', parsed.error.issues[0]?.message);
      return null;
    }
    const m = parsed.data;

    const yesPrice = m.tokens.find(t => t.outcome === 'Yes')?.price ?? m.tokens[0]?.price ?? '0.5';
    const noPrice  = m.tokens.find(t => t.outcome === 'No')?.price  ?? m.tokens[1]?.price ?? '0.5';

    return {
      conditionId: m.condition_id,
      closed: m.closed,
      outcomePrices: JSON.stringify([yesPrice, noPrice]),
      clobTokenIds: '[]',
    };
  } catch {
    return null;
  }
}

/**
 * Fallback: Gamma API by event slug.
 */
async function fetchByGammaSlug(marketSlug: string): Promise<GammaMarket | null> {
  try {
    const url = `${GAMMA_BASE}/events?slug=${encodeURIComponent(marketSlug)}`;
    const res = await clobFetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const raw = await res.json();
    const parsed = z.array(GammaEventSchema).safeParse(raw);
    if (!parsed.success) {
      console.warn('[settlement] Gamma API shape inesperado:', parsed.error.issues[0]?.message);
      return null;
    }
    const market = parsed.data[0]?.markets?.[0];
    if (!market) return null;
    return { ...market, conditionId: market.conditionId ?? '' };
  } catch {
    return null;
  }
}

async function fetchMarketResolution(
  conditionId: string | null,
  marketSlug: string,
): Promise<GammaMarket | null> {
  if (conditionId) {
    const byId = await fetchByClobConditionId(conditionId);
    if (byId) return byId;
  }
  return fetchByGammaSlug(marketSlug);
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
  exitReason: 'settled_win' | 'settled_loss' | 'settlement_timeout',
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
  maxAttempts = 20,  // 20 × 30s = 10 min — Polymarket can take up to 8 min to resolve
): Promise<void> {
  const market = await fetchMarketResolution(position.conditionId, position.marketSlug);
  const won = market ? parseWinner(market.outcomePrices, position.outcome) : null;

  if (won === null) {
    if (attempt >= maxAttempts) {
      // Mark as settlement_timeout — NOT as a loss. The sweep will retry on next restart.
      console.warn(`[settlement] Max retries para ${position.marketSlug} — marcando settlement_timeout (no es pérdida confirmada)`);
      await persistSettlement(supabase, position.id, 0, 'settlement_timeout', 0);
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
  // 30s delay para que la CLOB/Gamma API registre la resolución
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
  agentId: string,
): Promise<SweepResult[]> {
  // Include settlement_timeout — these were previously unresolvable and should be retried.
  // Scoped by agent_id so parallel agents (prod + 50x) only sweep their own positions.
  const { data, error } = await supabase
    .from('polyarb_positions')
    .select('id, market_slug, condition_id, outcome, shares, size_usd, exit_reason')
    .eq('agent_id', agentId)
    .in('status', ['CLOSED', 'LIQUIDATED'])
    .not('exit_reason', 'in', '("settled_win","settled_loss")')
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
      const market = await fetchMarketResolution(pos.condition_id, pos.market_slug);

      if (!market) {
        results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: 'api_unavailable' });
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
  agentId: string,
): Promise<void> {
  if (!redeemer.walletAddress) {
    console.log('[settlement] redeemPendingWins: sin wallet — se omite on-chain redemption');
    return;
  }

  // Scoped by agent_id so parallel agents (prod + 50x) only redeem their own wins.
  const { data, error } = await supabase
    .from('polyarb_positions')
    .select('id, market_slug, condition_id, outcome')
    .eq('agent_id', agentId)
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
      const market = await fetchByGammaSlug(pos.market_slug);
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
