/**
 * POST /api/treasury/payouts/create
 * Create a new payout record with breakdown
 * Validates blocking conditions, wallet mapping, and increments version
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkAiRateLimit } from '@/lib/security/aiRateLimit';
import { computeIntegrityHash } from '@/lib/security/integrity';
import { encryptNumeric, encryptForDomain } from '@/lib/security/encryption';
import { logError } from "@/lib/log";

interface CreatePayoutRequest {
  accountId: string; // UUID
  note?: string; // Optional note for the payout
}

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

    // Rate limit: 10 payout creates per hour (prevents spam)
    const { allowed, retryAfterSeconds } = await checkAiRateLimit(userId, 'treasury-payout-create', 10);
    if (!allowed) {
      return Response.json(
        { success: false, error: 'Rate limit exceeded. Max 10 payout creates per hour.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds ?? 3600) } }
      );
    }

    const body = (await request.json()) as CreatePayoutRequest;
    const { accountId, note } = body;

    // Validate input
    if (!accountId) {
      return Response.json(
        { success: false, error: 'accountId is required' },
        { status: 400 }
      );
    }

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
        .select('id, account_id, withdrawal_day, split_mode, balance_threshold, anti_drawdown_active, anti_drawdown_threshold, tax_buffer_percentage, wallet_id')
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

    // Calculate cycle dates
    let cycleStart = new Date(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), configData.withdrawal_day);
    if (cycleStart > todayUTC) {
      cycleStart = new Date(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 1, configData.withdrawal_day);
    }

    const cycleExpectedEnd = new Date(cycleStart);
    cycleExpectedEnd.setUTCMonth(cycleExpectedEnd.getUTCMonth() + 1);
    cycleExpectedEnd.setUTCDate(cycleExpectedEnd.getUTCDate() - 1);

    // Calculate period PnL
    const cycleStartStr = cycleStart.toISOString().split('T')[0];
    const todayStr = todayUTC.toISOString().split('T')[0];
    let periodPnL = 0;

    if (tradesData) {
      for (const trade of tradesData) {
        if (trade.account_id === accountId && trade.status === 'Closed') {
          const tradeDate = trade.exit_date || trade.entry_date || trade.created_at || '';
          const tradeDateStr = tradeDate.split('T')[0];
          if (tradeDateStr >= cycleStartStr && tradeDateStr <= todayStr) {
            periodPnL += trade.pnl;
          }
        }
      }
    }

    // Calculate drawdown
    let currentDrawdown = 0;
    if (tradesData) {
      const accountTrades = tradesData.filter(
        (t) => t.account_id === accountId && t.status === 'Closed'
      );
      if (accountTrades.length > 0) {
        let peak = accountData.account_size;
        let runningBalance = accountData.account_size;

        accountTrades.sort((a, b) => {
          const dateA = new Date(a.exit_date || a.entry_date || a.created_at || 0).getTime();
          const dateB = new Date(b.exit_date || b.entry_date || b.created_at || 0).getTime();
          return dateA - dateB;
        });

        for (const trade of accountTrades) {
          runningBalance += trade.pnl;
          if (runningBalance > peak) {
            peak = runningBalance;
          }
          const dd = peak > 0 ? ((peak - runningBalance) / peak) * 100 : 0;
          if (dd > currentDrawdown) {
            currentDrawdown = dd;
          }
        }
      }
    }

    // Check blocking conditions
    const blockedReasons: string[] = [];

    if (!accountData.withdrawals_enabled) {
      blockedReasons.push('withdrawals_disabled');
    }

    if (configData.anti_drawdown_active && currentDrawdown >= configData.anti_drawdown_threshold) {
      blockedReasons.push('anti_dd_active');
    }

    if (configData.balance_threshold && accountData.current_balance < configData.balance_threshold) {
      blockedReasons.push('balance_below_threshold');
    }

    if (blockedReasons.length > 0) {
      return Response.json(
        {
          success: false,
          error: 'Payout creation blocked',
          blockedReasons,
        },
        { status: 409 }
      );
    }

    // Calculate breakdown
    const profitTotal = accountData.current_balance - accountData.account_size;
    const payoutableProfit = Math.max(0, Math.min(periodPnL, profitTotal));

    const splitModes: Record<string, number> = {
      growth: 50,
      safe: 40,
      cash: 100,
    };
    const splitPercentage = splitModes[configData.split_mode] || 50;
    const retirable = payoutableProfit * (splitPercentage / 100);

    if (retirable <= 0) {
      return Response.json(
        { success: false, error: 'No retirable profit available' },
        { status: 400 }
      );
    }

    const taxReserveAmount = retirable * (configData.tax_buffer_percentage / 100);
    const bonusVaultAmount = 0; // Default 0, editable in Milestone
    const cashPayoutAmount = Math.max(0, retirable - taxReserveAmount - bonusVaultAmount);

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
