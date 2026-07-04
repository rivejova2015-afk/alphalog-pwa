import { createServiceClient } from '@/lib/supabase/server';
import { isGlobexOpen, isPastCutoffEt, nowToEt } from './market-hours';
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
  /** True cuando esta orden es un flatten+flip (cierra la posición actual y
   *  abre en la dirección opuesta con una sola orden combinada). El check de
   *  max-contracts-por-tier necesita saberlo para no contar la posición que
   *  se está cerrando como si fuera exposición nueva. */
  isReversal?: boolean;
  /** Override del "now" para tests. Default = Date.now(). */
  now?: Date;
}): Promise<RiskCheckResult> {
  const now = p.now ?? new Date();

  if (!isGlobexOpen(now)) {
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
      .select('max_daily_loss, max_trailing_dd, funded_amount, provider_name')
      .eq('id', p.cmeAccountId)
      .maybeSingle(),
    supabase
      .from('cme_positions')
      .select('id, is_manual, quantity')
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
  const account = accountRes.data as
    | { max_daily_loss?: number | null; max_trailing_dd?: number | null; funded_amount?: number | null; provider_name?: string | null }
    | null;
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

  const typedPositions = positions as { id: string; is_manual: boolean; quantity?: number | null }[];
  const hasManualPosition = typedPositions.some((pos) => pos.is_manual);
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

  // Max contracts per tier — Apex tiene límites estrictos por tier (PA values).
  // En una orden normal, sumamos quantity de las posiciones abiertas + la
  // quantity de la orden nueva y comparamos contra el límite del tier.
  // En un reversal, `p.quantity` ya incluye el tamaño necesario para cerrar
  // la posición actual (quantity = |netPos| + proposedQty, ver dispatcher) —
  // sumarle además `currentContracts` contaría esa misma posición dos veces.
  // La posición NETA resultante en un reversal es solo `p.quantity - currentContracts`.
  if (propfirmRule?.maxContractsByTier && account?.funded_amount != null) {
    const tierKey = String(Math.round(Number(account.funded_amount)));
    const limit = propfirmRule.maxContractsByTier[tierKey];
    if (limit != null) {
      const currentContracts = typedPositions.reduce(
        (sum, pos) => sum + Number(pos.quantity ?? 1),
        0,
      );
      const resultingContracts = p.isReversal
        ? Math.abs(p.quantity - currentContracts)
        : currentContracts + p.quantity;
      if (resultingContracts > limit) {
        return { allowed: false, reason: 'propfirm_max_contracts' };
      }
    }
  }

  // News blackout — MFFU exige flat 2 min antes/después de Tier 1 events
  // (FOMC/NFP/CPI específicamente). Lee terminal_events en la ventana, filtra
  // por impact level y opcionalmente por keywords en el nombre.
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
      .limit(50);
    const keywords = propfirmRule.newsBlackoutKeywords;
    const filtered = ((events ?? []) as { name: string | null }[]).filter((evt) => {
      if (!keywords || keywords.length === 0) return true;
      const name = String(evt.name ?? '').toLowerCase();
      return keywords.some((kw) => name.includes(kw.toLowerCase()));
    });
    if (filtered.length > 0) {
      return { allowed: false, reason: 'propfirm_news_blackout' };
    }
  }

  // Weekend holds — propfirms estrictas (futuro: Apex no permite holds weekend
  // según T&C). Si la regla lo prohíbe explícitamente y estamos en weekend
  // (sábado completo o domingo antes de la apertura ETH 18:00 ET), bloquea.
  // Aunque isGlobexOpen ya bloquea estos momentos, este check
  // refuerza la regla específica del propfirm para audit logs claros.
  if (propfirmRule?.disallowWeekendHolds) {
    const { dayOfWeek: dayWeekend, minutesOfDay: minWeekend } = nowToEt(now);
    const sundayBeforeOpen = dayWeekend === 0 && minWeekend < 18 * 60;
    if (dayWeekend === 6 || sundayBeforeOpen) {
      return { allowed: false, reason: 'propfirm_weekend_blocked' };
    }
  }

  // Trailing drawdown check — propfirms bloquean cuando equity actual cae bajo
  // (peak - max_trailing_dd). Si el propfirm tiene lock-at-profit (Apex EOD,
  // MFFU Pro, Tradeify Select), el peak efectivo se fija en funded+lock una vez
  // que el equity lo alcanzó (no puede bajar de ahí aunque el peak histórico
  // sea más alto — y tampoco puede bajar del trailing original).
  //
  // El peak y el equity actual se piden con 2 queries de 1 fila cada una
  // (ORDER BY equity_usd DESC / ORDER BY snapshot_at DESC, ambas LIMIT 1) en
  // vez de traer hasta 500 filas ordenadas por tiempo: a la frecuencia real
  // de equity-sync (cada 5min, weekdays) 500 filas cubren ~1.7-2 días, no los
  // 90 días pretendidos, dejando invisible cualquier peak más viejo que eso.
  if (account?.max_trailing_dd) {
    const fundedAmount = Number(account.funded_amount ?? 0);
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [peakRes, currentRes] = await Promise.all([
      supabase
        .from('cme_equity_snapshots')
        .select('equity_usd')
        .eq('user_id', p.userId)
        .eq('cme_account_id', p.cmeAccountId)
        .gte('snapshot_at', cutoff)
        .order('equity_usd', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('cme_equity_snapshots')
        .select('equity_usd, snapshot_at')
        .eq('user_id', p.userId)
        .eq('cme_account_id', p.cmeAccountId)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const peakRow = peakRes.data as { equity_usd: number } | null;
    const currentRow = currentRes.data as { equity_usd: number; snapshot_at: string } | null;

    if (currentRow) {
      const observedPeak = Math.max(fundedAmount, Number(peakRow?.equity_usd ?? 0));
      const currentEquity = Number(currentRow.equity_usd);
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
  }

  return { allowed: true };
}
