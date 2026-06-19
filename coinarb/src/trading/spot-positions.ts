/**
 * Spot position persistence — replaces the polymarket-era coinarb-positions.ts.
 *
 * Schema split:
 *   - coinarb_positions: aggregate row per position (open + close lifecycle)
 *   - coinarb_trades: one row per fill (ENTRY + EXIT) keyed by position_id
 *
 * On openPosition we insert one positions row + one trades row (ENTRY).
 * On closePosition we update the positions row + insert a trades row (EXIT)
 * and write a calibration row for the dashboard's reliability diagram.
 */

import { COINARB_AGENT_ID, COINARB_USER_ID, type Symbol } from '../core/config.js';
import { getSupabase } from '../supabase.js';

export type StrategyId = 'A' | 'B';

export interface OpenPositionInput {
  symbol: Symbol;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  baseQty: number;
  sizeUsd: number;
  stopLoss: number;
  takeProfit: number;
  smcZoneType: string;
  smcZonePrice: number;
  arbGapPct: number;
  fearGreedAtEntry: number;
  phaseAtEntry: string;
  entryReason: {
    regime: string;
    tier: string;
    validatorConfidence: number;
    [key: string]: unknown;
  };
  feeUsd: number;
  externalOrderId?: string;
  /** Strategy that opened this position. Defaults to 'A' for backwards compat. */
  strategyId?: StrategyId;
}

export interface OpenPositionRow {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry_price: number;
  base_qty: number;
  size_usd: number;
  stop_loss_price: number;
  take_profit_price: number;
  opened_at: string;
}

export interface CloseInput {
  positionId: string;
  exitPrice: number;
  exitReason: 'TP' | 'SL' | 'MANUAL' | 'EOD' | 'CIRCUIT';
  feeUsd: number;
  externalOrderId?: string;
}

const TAKER_FEE_BPS = 60;

function ensureUserId(): string {
  if (!COINARB_USER_ID) throw new Error('COINARB_USER_ID env var is required for DB writes');
  return COINARB_USER_ID;
}

export async function openPosition(input: OpenPositionInput): Promise<OpenPositionRow> {
  const userId = ensureUserId();
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const strategyId: StrategyId = input.strategyId ?? 'A';

  const { data: pos, error } = await supabase
    .from('coinarb_positions')
    .insert({
      user_id: userId,
      agent_id: COINARB_AGENT_ID,
      strategy_id: strategyId,
      symbol: input.symbol,
      direction: input.direction,
      side: input.direction,
      entry_price: input.entryPrice,
      base_qty: input.baseQty,
      size_usd: input.sizeUsd,
      stop_loss_price: input.stopLoss,
      take_profit_price: input.takeProfit,
      smc_zone_type: input.smcZoneType,
      smc_zone_price: input.smcZonePrice,
      arb_gap_pct: input.arbGapPct,
      fear_greed_at_entry: input.fearGreedAtEntry,
      phase_at_entry: input.phaseAtEntry,
      entry_reason: input.entryReason,
      status: 'OPEN',
      opened_at: now,
    })
    .select('id, symbol, direction, entry_price, base_qty, size_usd, stop_loss_price, take_profit_price, opened_at')
    .single();

  if (error || !pos) throw new Error(`[spot-positions] open failed: ${error?.message}`);

  await supabase.from('coinarb_trades').insert({
    user_id: userId,
    agent_id: COINARB_AGENT_ID,
    strategy_id: strategyId,
    position_id: pos.id,
    order_id: input.externalOrderId ?? null,
    symbol: input.symbol,
    direction: input.direction,
    side: input.direction,
    price: input.entryPrice,
    size: input.baseQty,
    size_usd: input.sizeUsd,
    fee_usd: input.feeUsd,
    fee_rate_bps: TAKER_FEE_BPS,
    status: 'FILLED',
    trade_type: 'ENTRY',
    executed_at: now,
  });

  return pos as OpenPositionRow;
}

export async function closePosition(input: CloseInput): Promise<{ pnlUsd: number; pnlPct: number }> {
  const userId = ensureUserId();
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: pos, error: posErr } = await supabase
    .from('coinarb_positions')
    .select('id, symbol, direction, entry_price, base_qty, size_usd, opened_at, entry_reason, smc_zone_type, smc_zone_price, arb_gap_pct, fear_greed_at_entry, phase_at_entry, strategy_id')
    .eq('id', input.positionId)
    .single();

  if (posErr || !pos) throw new Error(`[spot-positions] position ${input.positionId} not found: ${posErr?.message}`);

  const dir = (pos.direction ?? 'BUY') as 'BUY' | 'SELL';
  const strategyId: StrategyId = ((pos as { strategy_id?: string }).strategy_id as StrategyId | undefined) ?? 'A';
  const grossPnl = dir === 'BUY'
    ? (input.exitPrice - pos.entry_price) * pos.base_qty
    : (pos.entry_price - input.exitPrice) * pos.base_qty;
  const pnlUsd = grossPnl - input.feeUsd;
  const pnlPct = pos.size_usd > 0 ? (pnlUsd / pos.size_usd) * 100 : 0;

  const { error: updErr } = await supabase
    .from('coinarb_positions')
    .update({
      status: 'CLOSED',
      exit_price: input.exitPrice,
      exit_reason: input.exitReason,
      pnl_usd: pnlUsd,
      pnl_percent: pnlPct,
      closed_at: now,
    })
    .eq('id', input.positionId);

  if (updErr) throw new Error(`[spot-positions] close update failed: ${updErr.message}`);

  await supabase.from('coinarb_trades').insert({
    user_id: userId,
    agent_id: COINARB_AGENT_ID,
    strategy_id: strategyId,
    position_id: input.positionId,
    order_id: input.externalOrderId ?? null,
    symbol: pos.symbol,
    direction: dir,
    side: dir === 'BUY' ? 'SELL' : 'BUY',
    price: input.exitPrice,
    size: pos.base_qty,
    size_usd: pos.size_usd,
    pnl_usd: pnlUsd,
    fee_usd: input.feeUsd,
    fee_rate_bps: TAKER_FEE_BPS,
    status: 'FILLED',
    trade_type: 'EXIT',
    executed_at: now,
  });

  await writeCalibrationRow({
    pos: { id: pos.id, symbol: pos.symbol, entry_reason: pos.entry_reason as Record<string, unknown> | null, arb_gap_pct: pos.arb_gap_pct },
    pnlUsd,
    closedAt: now,
    userId,
  });

  return { pnlUsd, pnlPct };
}

async function writeCalibrationRow(args: {
  pos: { id: string; symbol: string; entry_reason: Record<string, unknown> | null; arb_gap_pct: number | null };
  pnlUsd: number;
  closedAt: string;
  userId: string;
}): Promise<void> {
  try {
    const supabase = getSupabase();
    const reason = args.pos.entry_reason ?? {};
    const rawConfidence = typeof reason.validatorConfidence === 'number' ? reason.validatorConfidence : 0.5;
    const confidence = Math.max(0, Math.min(1, rawConfidence));
    const tier = typeof reason.tier === 'string' ? reason.tier : null;
    const regime = typeof reason.regime === 'string' ? reason.regime : null;
    const outcome = args.pnlUsd > 0 ? 1 : 0;
    const brier = (confidence - outcome) ** 2;

    await supabase.from('coinarb_calibration').insert({
      user_id: args.userId,
      agent_id: COINARB_AGENT_ID,
      position_id: args.pos.id,
      symbol: args.pos.symbol,
      venue: 'spot',
      predicted_confidence: confidence,
      predicted_edge: args.pos.arb_gap_pct,
      regime,
      tier,
      outcome,
      pnl_usd: args.pnlUsd,
      brier_score: brier,
      closed_at: args.closedAt,
    });
  } catch (err) {
    console.error('[spot-positions] calibration write failed:', err);
  }
}

export async function getOpenPositions(): Promise<OpenPositionRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('coinarb_positions')
    .select('id, symbol, direction, entry_price, base_qty, size_usd, stop_loss_price, take_profit_price, opened_at')
    .eq('agent_id', COINARB_AGENT_ID)
    .eq('status', 'OPEN');
  if (error) throw new Error(`[spot-positions] getOpen failed: ${error.message}`);
  return (data ?? []) as OpenPositionRow[];
}
