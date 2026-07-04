/**
 * POST /api/treasury/payouts/preview
 * Preview payout calculation for one or all accounts
 * Does not create anything, safe for multiple calls
 * Sends threshold push notifications if conditions are met
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { sendThresholdPush } from '@/lib/treasury/pushNotifications';
import { logError, logWarn } from "@/lib/log";
import { calculateDrawdown } from '@/lib/treasury/calculations';
import {
  computeCycleStart,
  computeCycleExpectedEnd,
  calculatePeriodPnL,
  calculatePayoutBreakdown,
  shouldSendThresholdPush,
} from '@/lib/treasury/payoutEngine';

// accountId is either the literal string "ALL" or a UUID. Other values are
// rejected before hitting downstream filters to catch typos/malformed input.
const previewSchema = z.object({
  accountId: z.union([z.literal("ALL"), z.string().uuid()]).optional(),
});

interface PreviewRequest {
  accountId?: string; // "ALL" or UUID
}

interface AccountPreview {
  accountId: string;
  accountName: string;
  cycleStart: string; // ISO date
  cycleExpectedEnd: string; // ISO date
  calcCutoff: string; // ISO date
  currentBalance: number;
  accountSize: number;
  periodPnL: number;
  currentDrawdown: number;
  retirable: number;
  taxReserveAmount: number;
  bonusVaultAmount: number;
  cashPayoutAmount: number;
  blockedReasons: string[];
  isCreatable: boolean;
  hasThresholdCondition: boolean;
  walletMapped: boolean;
}

interface PreviewResponse {
  success: boolean;
  cycleStart: string; // ISO date
  cycleExpectedEnd: string; // ISO date
  calcCutoff: string; // ISO date
  cycleDatesFormatted: string;
  perAccountPreview: AccountPreview[];
  totals: {
    retirable: number;
    taxReserve: number;
    bonusVault: number;
    cashPayout: number;
  };
  pushNotificationsPending: Array<{
    accountId: string;
    accountName: string;
    message: string;
  }>;
  error?: string;
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

    let rawBody: unknown;
    try { rawBody = await request.json(); } catch { return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

    const parsed = previewSchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const { accountId } = parsed.data;

    const todayUTC = new Date();

    // Fetch all required data
    const [
      { data: accountsData },
      { data: configsData },
      { data: tradesData },
    ] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, account_size, current_balance, phase_status, withdrawals_enabled')
        .eq('user_id', userId)
        .is('deleted_at', null),
      supabase
        .from('treasury_configs')
        .select('id, account_id, withdrawal_day, split_mode, balance_threshold, anti_drawdown_active, anti_drawdown_threshold, tax_buffer_percentage, wallet_id, last_threshold_push_cycle_start')
        .eq('user_id', userId)
        .is('deleted_at', null),
      supabase
        .from('trades')
        .select('id, account_id, entry_date, exit_date, created_at, pnl, status')
        .eq('user_id', userId)
        .is('deleted_at', null),
    ]);

    if (!accountsData || !configsData || !tradesData) {
      return Response.json(
        { success: false, error: 'Failed to fetch data' },
        { status: 500 }
      );
    }

    // Filter accounts if specific accountId provided
    let accountsToProcess = accountsData;
    if (accountId && accountId !== 'ALL') {
      accountsToProcess = accountsData.filter((a) => a.id === accountId);
      if (accountsToProcess.length === 0) {
        return Response.json(
          { success: false, error: 'Account not found' },
          { status: 404 }
        );
      }
    }

    // Create config map for quick lookup
    const configMap = new Map();
    configsData.forEach((config) => {
      configMap.set(config.account_id, config);
    });

    // Process each account
    const perAccountPreview: AccountPreview[] = [];
    const pushNotificationsPending = [];
    let totalRetirable = 0;
    let totalTaxReserve = 0;
    let totalBonusVault = 0;
    let totalCashPayout = 0;

    for (const account of accountsToProcess) {
      const config = configMap.get(account.id);
      if (!config) {
        // No config for this account, skip
        continue;
      }

      // Cycle dates: clamps withdrawal_day to 28 internally so months with
      // fewer days (e.g. Feb) don't roll over into the next month.
      const cycleStart = computeCycleStart(config.withdrawal_day, todayUTC);
      const cycleExpectedEnd = computeCycleExpectedEnd(config.withdrawal_day, cycleStart);

      // Calculate period PnL
      const periodPnL = calculatePeriodPnL(
        account.id,
        tradesData,
        cycleStart,
        todayUTC
      );

      // Calculate drawdown
      const currentDrawdown = calculateDrawdown(
        account.id,
        account,
        tradesData
      );

      // Calculate breakdown
      const breakdown = calculatePayoutBreakdown(
        account as any,
        config as any,
        periodPnL,
        currentDrawdown
      );

      // Check for threshold push condition
      const hasThresholdCondition = shouldSendThresholdPush(
        account as any,
        config as any,
        breakdown.retirable
      );

      // Check if wallet is mapped
      const walletMapped = !!config.wallet_id;

      const cycleStartStr = cycleStart.toISOString().split('T')[0];

      // Add to preview
      perAccountPreview.push({
        accountId: account.id,
        accountName: account.name,
        cycleStart: cycleStartStr,
        cycleExpectedEnd: cycleExpectedEnd.toISOString().split('T')[0],
        calcCutoff: todayUTC.toISOString().split('T')[0],
        currentBalance: account.current_balance,
        accountSize: account.account_size,
        periodPnL,
        currentDrawdown,
        retirable: breakdown.retirable,
        taxReserveAmount: breakdown.taxReserveAmount,
        bonusVaultAmount: breakdown.bonusVaultAmount,
        cashPayoutAmount: breakdown.cashPayoutAmount,
        blockedReasons: breakdown.blockedReasons,
        isCreatable: breakdown.blockedReasons.length === 0 && breakdown.retirable > 0 && walletMapped,
        hasThresholdCondition,
        walletMapped,
      });

      // Accumulate totals
      totalRetirable += breakdown.retirable;
      totalTaxReserve += breakdown.taxReserveAmount;
      totalBonusVault += breakdown.bonusVaultAmount;
      totalCashPayout += breakdown.cashPayoutAmount;

      // Check if push should be sent (and hasn't been sent this cycle already)
      if (hasThresholdCondition && config.last_threshold_push_cycle_start !== cycleStartStr) {
        pushNotificationsPending.push({
          accountId: account.id,
          accountName: account.name,
          message: `Umbral alcanzado - Ya puedes retirar en ${account.name}`,
        });

        // Send the push notification
        const pushSent = await sendThresholdPush(
          {
            accountId: account.id,
            accountName: account.name,
            userId,
            cycleStartDate: cycleStartStr,
          },
          supabase
        );

        if (!pushSent) {
          logWarn("TreasuryPayouts", "Could not send threshold push (no subscriptions?)", { component: "treasury.payouts.preview.push", accountName: account.name });
        }
      }
    }

    // Use first account's cycle for global response (all accounts have same withdrawal day in a user context)
    const globalCycleStart = perAccountPreview.length > 0 
      ? perAccountPreview[0].cycleStart 
      : todayUTC.toISOString().split('T')[0];
    const globalCycleEnd = perAccountPreview.length > 0
      ? perAccountPreview[0].cycleExpectedEnd
      : todayUTC.toISOString().split('T')[0];

    return Response.json({
      success: true,
      cycleStart: globalCycleStart,
      cycleExpectedEnd: globalCycleEnd,
      calcCutoff: todayUTC.toISOString().split('T')[0],
      cycleDatesFormatted: `${new Date(globalCycleStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(globalCycleEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      perAccountPreview,
      totals: {
        retirable: totalRetirable,
        taxReserve: totalTaxReserve,
        bonusVault: totalBonusVault,
        cashPayout: totalCashPayout,
      },
      pushNotificationsPending,
    } as PreviewResponse);
  } catch (error) {
    logError("TreasuryPayouts", { component: "treasury.payouts.preview", message: "Error:", error: error instanceof Error ? error.message : String(error) });
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

