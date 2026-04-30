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

  const [riskRes, accountRes, positionsRes, connectionRes] = await Promise.all([
    supabase
      .from('cme_risk_configs')
      .select('enabled, paused_reason, circuit_breaker_pct, max_positions')
      .eq('user_id', p.userId)
      .eq('cme_account_id', p.cmeAccountId)
      .maybeSingle(),
    supabase
      .from('algo_cme_accounts')
      .select('max_daily_loss')
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
  ]);

  const risk = riskRes.data;
  const account = accountRes.data;
  const positions = positionsRes.data ?? [];
  const connection = connectionRes.data;

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

  return { allowed: true };
}
