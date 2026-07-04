/**
 * POST /api/treasury/payouts/create
 * Create a new payout record with breakdown
 * Validates blocking conditions, wallet mapping, and increments version
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { checkAiRateLimit } from '@/lib/security/aiRateLimit';
import { computeIntegrityHash } from '@/lib/security/integrity';
import { encryptNumeric, encryptForDomain } from '@/lib/security/encryption';
import { requireFreshStepUp } from '@/lib/security/stepUp';
import { logError } from "@/lib/log";
import { computeCycleStart, computeCycleExpectedEnd, calculatePeriodPnL, calculatePayoutBreakdown } from '@/lib/treasury/payoutEngine';
import { calculateDrawdown } from '@/lib/treasury/calculations';

const createSchema = z.object({
  accountId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

interface CreatePayoutResponse {
  success: boolean;
  payoutId?: string;
  cycleStart?: string;
  version?: number;
  breakdown?: {
    retirable: number;
    taxReserveAmount: number;
    bonusVaultAmount: number;
    cashPayoutAmount: number;
  };
  error?: string;
  blockedReasons?: string[];
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = sessionData.session.user.id;

    // SECURITY (audit 2026-06, Área 13): financial write requires a recent MFA
    // step-up, not just an old AAL2 session.
    const stepUp = await requireFreshStepUp(supabase);
    if (!stepUp.ok) {
      return Response.json(
        { success: false, error: 'step_up_required', reason: stepUp.reason },
        { status: stepUp.status }
      );
    }

    // Rate limit: 10 payout creates per hour (prevents spam)
    const { allowed, retryAfterSeconds } = await checkAiRateLimit(userId, 'treasury-payout-create', 10);
    if (!allowed) {
      return Response.json(
        { success: false, error: 'Rate limit exceeded. Max 10 payout creates per hour.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds ?? 3600) } }
      );
    }

    let parsed: z.infer<typeof createSchema>;
    try {
      const raw = await request.json();
      parsed = createSchema.parse(raw);
    } catch (err) {
      const message = err instanceof z.ZodError ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'Invalid request body';
      return Response.json({ success: false, error: message }, { status: 400 });
    }
    const { accountId, note } = parsed;

    // Fetch account, config, and trades
    const todayUTC = new Date();
    const [
      { data: accountData, error: accountError },
      { data: configData, error: configError },
      { data: tradesData },
    ] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, account_size, current_balance, phase_status, withdrawals_enabled')
        .eq('id', accountId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single(),
      supabase
        .from('treasury_configs')
        .select('id, account_id, withdrawal_day, split_mode, balance_threshold, anti_drawdown_active, anti_drawdown_threshold, tax_buffer_percentage, tax_buffer_accumulated, wallet_id')
        .eq('account_id', accountId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single(),
      supabase
        .from('trades')
        .select('id, account_id, entry_date, exit_date, created_at, pnl, status')
        .eq('user_id', userId)
        .is('deleted_at', null),
    ]);

    if (accountError || !accountData) {
      return Response.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    if (configError || !configData) {
      return Response.json(
        { success: false, error: 'Treasury config not found' },
        { status: 404 }
      );
    }

    // Validate wallet mapping
    if (!configData.wallet_id) {
      return Response.json(
        { success: false, error: 'Wallet mapping required (set wallet_id in config)' },
        { status: 400 }
      );
    }

    // Cycle dates: clamps withdrawal_day to 28 internally so months with
    // fewer days (e.g. Feb) don't roll over into the next month.
    const cycleStart = computeCycleStart(configData.withdrawal_day, todayUTC);
    const cycleExpectedEnd = computeCycleExpectedEnd(configData.withdrawal_day, cycleStart);
    const cycleStartStr = cycleStart.toISOString().split('T')[0];
    const todayStr = todayUTC.toISOString().split('T')[0];

    const periodPnL = tradesData
      ? calculatePeriodPnL(accountId, tradesData, cycleStart, todayUTC)
      : 0;
    const currentDrawdown = tradesData
      ? calculateDrawdown(accountId, accountData, tradesData)
      : 0;

    const breakdown = calculatePayoutBreakdown(
      accountData as any,
      configData as any,
      periodPnL,
      currentDrawdown
    );

    if (breakdown.blockedReasons.length > 0) {
      return Response.json(
        {
          success: false,
          error: 'Payout creation blocked',
          blockedReasons: breakdown.blockedReasons,
        },
        { status: 409 }
      );
    }

    const { retirable, taxReserveAmount, bonusVaultAmount, cashPayoutAmount } = breakdown;

    if (retirable <= 0) {
      return Response.json(
        { success: false, error: 'No retirable profit available' },
        { status: 400 }
      );
    }

    // Get max version for this cycle
    const { data: existingPayouts } = await supabase
      .from('treasury_payouts')
      .select('version')
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('cycle_start', cycleStartStr)
      .is('deleted_at', null)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = (existingPayouts && existingPayouts.length > 0)
      ? existingPayouts[0].version + 1
      : 1;

    const integrityHash = computeIntegrityHash({
      user_id: userId,
      account_id: accountId,
      amount: cashPayoutAmount,
      cash_payout_amount: cashPayoutAmount,
      tax_reserve_amount: taxReserveAmount,
      bonus_vault_amount: bonusVaultAmount,
      cycle_start: cycleStartStr,
      version: nextVersion,
    });

    // Create payout record
    const { data: newPayout, error: insertError } = await supabase
      .from('treasury_payouts')
      .insert({
        user_id: userId,
        account_id: accountId,
        wallet_id: configData.wallet_id,
        payout_date: todayStr,
        amount: cashPayoutAmount,
        status: 'planned',
        notes: note ? encryptForDomain("treasury", note) : null,
        cycle_start: cycleStartStr,
        cycle_expected_end: cycleExpectedEnd.toISOString().split('T')[0],
        calc_cutoff: todayStr,
        version: nextVersion,
        cash_payout_amount: cashPayoutAmount,
        tax_reserve_amount: taxReserveAmount,
        bonus_vault_amount: bonusVaultAmount,
        blocked_reasons: [],
        _integrity_hash: integrityHash,
        amount_enc: encryptNumeric("treasury", cashPayoutAmount),
      })
      .select('id')
      .single();

    if (insertError || !newPayout) {
      logError("TreasuryPayouts", { component: "treasury.payouts.create", message: "Insert error:", error: insertError instanceof Error ? insertError.message : String(insertError) });
      return Response.json(
        { success: false, error: 'Failed to create payout' },
        { status: 500 }
      );
    }

    // Accumulate the tax reserve of this payout into the config's running
    // total. Best-effort: the payout itself already succeeded, so a failure
    // here shouldn't fail the request — it just means tax_buffer_accumulated
    // drifts from reality until the next successful payout catches it up.
    if (taxReserveAmount > 0) {
      const { error: taxBufferError } = await supabase
        .from('treasury_configs')
        .update({ tax_buffer_accumulated: (configData.tax_buffer_accumulated ?? 0) + taxReserveAmount })
        .eq('id', configData.id);
      if (taxBufferError) {
        logError("TreasuryPayouts", { component: "treasury.payouts.create.tax_buffer", message: "Failed to update tax_buffer_accumulated", error: taxBufferError.message });
      }
    }

    return Response.json({
      success: true,
      payoutId: newPayout.id,
      cycleStart: cycleStartStr,
      version: nextVersion,
      breakdown: {
        retirable,
        taxReserveAmount,
        bonusVaultAmount,
        cashPayoutAmount,
      },
    } as CreatePayoutResponse);
  } catch (error) {
    logError("TreasuryPayouts", { component: "treasury.payouts.create", message: "Error:", error: error instanceof Error ? error.message : String(error) });
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
