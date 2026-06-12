import { createServiceClient } from '@/lib/supabase/server';
import { isMarketHours } from './market-hours';

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export async function checkOrderRisk(p: {
  userId: string;
  cmeAccountId: string;
  direction: 'BUY' | 'SELL';
  quantity: number;
}): Promise<RiskCheckResult> {
  if (!isMarketHours()) {
    return { allowed: false, reason: 'outside_market_hours' };
  }

  const supabase = createServiceClient();

  const [riskRes, accountRes, positionsRes, connectionRes, equityRes] = await Promise.all([
    supabase
      .from('cme_risk_configs')
      .select('enabled, paused_reason, circuit_breaker_pct, max_positions')
      .eq('user_id', p.userId)
      .eq('cme_account_id', p.cmeAccountId)
      .maybeSingle(),
    supabase
      .from('algo_cme_accounts')
      .select('max_daily_loss, max_trailing_dd, funded_amount')
      .eq('id', p.cmeAccountId)
      .maybeSingle(),
    supabase
      .from('cme_positions')
      .select('id, is_manual')
      .eq('user_id', p.userId)
      .eq('cme_account_id', p.cmeAccountId),
    supabase
      .from('cme_connections')
      .select('daily_pnl_usd, status')
      .eq('user_id', p.userId)
      .eq('cme_account_id', p.cmeAccountId)
      .maybeSingle(),
    // Para max_trailing_dd: snapshots de equity (peak histórico vs equity actual).
    supabase
      .from('cme_equity_snapshots')
      .select('equity_usd, snapshot_at')
      .eq('user_id', p.userId)
      .eq('cme_account_id', p.cmeAccountId)
      .gte('snapshot_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('snapshot_at', { ascending: false })
      .limit(500),
  ]);

  const risk = riskRes.data;
  const account = accountRes.data;
  const positions = positionsRes.data ?? [];
  const connection = connectionRes.data;
  const equitySnaps = (equityRes.data ?? []) as { equity_usd: number; snapshot_at: string }[];

  if (!risk || !risk.enabled) {
    return {
      allowed: false,
      reason: risk?.paused_reason ?? 'account_disabled',
    };
  }

  if (connection?.status !== 'connected') {
    return { allowed: false, reason: 'account_not_connected' };
  }

  const hasManualPosition = positions.some((pos: { id: string; is_manual: boolean }) => pos.is_manual);
  if (hasManualPosition) {
    return { allowed: false, reason: 'manual_position_active' };
  }

  if (account?.max_daily_loss && risk.circuit_breaker_pct) {
    const threshold = Number(account.max_daily_loss) * (Number(risk.circuit_breaker_pct) / 100);
    const dailyPnl = Number(connection?.daily_pnl_usd ?? 0);
    if (dailyPnl <= -threshold) {
      return { allowed: false, reason: 'circuit_breaker_threshold' };
    }
  }

  if (risk.max_positions !== null && risk.max_positions !== undefined) {
    if (positions.length >= risk.max_positions) {
      return { allowed: false, reason: 'max_positions_reached' };
    }
  }

  // Trailing drawdown check — propfirms (Apex/MyFundedFutures/etc) bloquean
  // la cuenta cuando equity actual cae bajo (peak_equity - max_trailing_dd).
  // El propfirm más estricto usa "trailing del máximo histórico" (NUNCA baja);
  // simplificamos a "peak de últimos 90 días" que es seguro para empezar.
  if (account?.max_trailing_dd && equitySnaps.length > 0) {
    const peakEquity = Math.max(
      Number(account.funded_amount ?? 0),
      ...equitySnaps.map((s) => Number(s.equity_usd)),
    );
    const currentEquity = Number(equitySnaps[0].equity_usd); // más reciente (DESC)
    const drawdownFromPeak = peakEquity - currentEquity;
    if (drawdownFromPeak >= Number(account.max_trailing_dd)) {
      return { allowed: false, reason: 'max_trailing_dd_breached' };
    }
  }

  return { allowed: true };
}
