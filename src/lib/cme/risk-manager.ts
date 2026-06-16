import { createServiceClient } from '@/lib/supabase/server';
import { isMarketHours, isPastCutoffEt } from './market-hours';
import { getPropfirmRule } from './propfirm-rules';

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export async function checkOrderRisk(p: {
  userId: string;
  cmeAccountId: string;
  direction: 'BUY' | 'SELL';
  quantity: number;
  /** Override del "now" para tests. Default = Date.now(). */
  now?: Date;
}): Promise<RiskCheckResult> {
  const now = p.now ?? new Date();

  if (!isMarketHours(now)) {
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
      .select('max_daily_loss, max_trailing_dd, funded_amount, provider_name')
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
      .gte('snapshot_at', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('snapshot_at', { ascending: false })
      .limit(500),
  ]);

  const risk = riskRes.data;
  const account = accountRes.data as
    | { max_daily_loss?: number | null; max_trailing_dd?: number | null; funded_amount?: number | null; provider_name?: string | null }
    | null;
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

  // ── Reglas específicas por propfirm (Fase 2 — Apex/Lucid/MFFU/Tradeify) ──
  // Identificación por algo_cme_accounts.provider_name (TEXT match contra
  // PROPFIRM_RULES). Provider desconocido → skip propfirm checks.
  const propfirmRule = getPropfirmRule(account?.provider_name);

  // Overnight cutoff — Apex (16:59 ET), Lucid (16:45 ET), Tradeify (16:55 ET).
  // MFFU permite holds → no tiene cutoff configurado.
  if (propfirmRule?.overnightCutoffEt && isPastCutoffEt(now, propfirmRule.overnightCutoffEt)) {
    return { allowed: false, reason: 'propfirm_overnight_cutoff' };
  }

  // News blackout — MFFU exige flat 2 min antes/después de Tier 1 events
  // (FOMC/NFP/CPI). Lee terminal_events impact='high' en la ventana.
  if (propfirmRule?.newsBlackoutMinutesBefore != null || propfirmRule?.newsBlackoutMinutesAfter != null) {
    const beforeMin = propfirmRule.newsBlackoutMinutesBefore ?? 0;
    const afterMin = propfirmRule.newsBlackoutMinutesAfter ?? 0;
    const impacts = propfirmRule.newsBlackoutImpactLevels ?? ['high'];
    const windowStart = new Date(now.getTime() - afterMin * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + beforeMin * 60 * 1000).toISOString();
    const { data: events } = await supabase
      .from('terminal_events')
      .select('id, name, impact, timestamp_utc')
      .in('impact', impacts as string[])
      .gte('timestamp_utc', windowStart)
      .lte('timestamp_utc', windowEnd)
      .limit(1);
    if (events && events.length > 0) {
      return { allowed: false, reason: 'propfirm_news_blackout' };
    }
  }

  // Trailing drawdown check — propfirms bloquean cuando equity actual cae bajo
  // (peak - max_trailing_dd). Si el propfirm tiene lock-at-profit (Apex EOD,
  // MFFU Pro, Tradeify Select), el peak efectivo se fija en funded+lock una vez
  // que el equity lo alcanzó (no puede bajar de ahí aunque el peak histórico
  // sea más alto — y tampoco puede bajar del trailing original).
  if (account?.max_trailing_dd && equitySnaps.length > 0) {
    const fundedAmount = Number(account.funded_amount ?? 0);
    const observedPeak = Math.max(
      fundedAmount,
      ...equitySnaps.map((s) => Number(s.equity_usd)),
    );
    const currentEquity = Number(equitySnaps[0].equity_usd); // más reciente (DESC)
    let effectivePeak = observedPeak;
    if (propfirmRule?.trailingDdLockAtProfitDollars != null) {
      const lockFloor = fundedAmount + propfirmRule.trailingDdLockAtProfitDollars;
      // Si en algún momento equity alcanzó el lock, el peak efectivo no baja de ahí.
      const everReachedLock = observedPeak >= lockFloor;
      if (everReachedLock) effectivePeak = Math.max(observedPeak, lockFloor);
    }
    const drawdownFromPeak = effectivePeak - currentEquity;
    if (drawdownFromPeak >= Number(account.max_trailing_dd)) {
      return { allowed: false, reason: 'max_trailing_dd_breached' };
    }
  }

  return { allowed: true };
}
