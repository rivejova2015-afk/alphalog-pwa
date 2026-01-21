import { createClient } from '@supabase/supabase-js';
import { getMonthDateRange, calculateExportSummary, generateTreasuryExportCsv, type ExportData } from '@/lib/treasury/exportCsv';

/**
 * GET /api/treasury/export
 * Export monthly treasury summary, payouts, and transactions as CSV
 *
 * Query Parameters:
 *   month: YYYY-MM (required) - Month to export
 *
 * Returns:
 *   Content-Type: text/csv
 *   Content-Disposition: attachment
 */

export async function GET(request: Request) {
  try {
    // Get month parameter
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !month.match(/^\d{4}-\d{2}$/)) {
      return new Response(
        'Invalid month format. Use YYYY-MM (e.g., 2026-01)',
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized: No session', { status: 401 });
    }

    // Verify session (get user from auth token via Supabase)
    const token = authHeader.substring(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response('Unauthorized: Invalid session', { status: 401 });
    }

    const userId = user.id;

    // Get date range for month
    const { from, to } = getMonthDateRange(month);

    // ===== FETCH DATA =====

    // Fetch trades (for PnL calculation)
    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select('id, status, pnl, pnl_percent, closed_at, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', from.toISOString())
      .lte('updated_at', to.toISOString());

    if (tradesError) {
      console.error('[Export] Error fetching trades:', tradesError);
      return new Response('Error fetching trades', { status: 500 });
    }

    // Fetch payouts with account names
    const { data: payouts, error: payoutsError } = await supabase
      .from('treasury_payouts')
      .select(
        `
        id,
        account_id,
        payout_date,
        amount,
        status,
        cash_payout_amount,
        tax_reserve_amount,
        bonus_vault_amount,
        pnl_snapshot,
        cycle_start,
        cycle_expected_end,
        created_at,
        treasury_accounts!inner(id, name)
        `
      )
      .eq('user_id', userId)
      .gte('payout_date', from.toISOString())
      .lte('payout_date', to.toISOString())
      .is('deleted_at', null);

    if (payoutsError) {
      console.error('[Export] Error fetching payouts:', payoutsError);
      return new Response('Error fetching payouts', { status: 500 });
    }

    // Flatten payout account names
    const payoutsFormatted = payouts.map((p: any) => ({
      ...p,
      account_name: p.treasury_accounts?.name || p.account_id,
      treasury_accounts: undefined, // Remove nested object
    }));

    // Fetch transactions with account names
    const { data: transactions, error: txError } = await supabase
      .from('treasury_transactions')
      .select(
        `
        id,
        account_id,
        tx_date,
        tx_type,
        description,
        amount,
        balance_after,
        created_at,
        treasury_accounts!inner(id, name)
        `
      )
      .eq('user_id', userId)
      .gte('tx_date', from.toISOString())
      .lte('tx_date', to.toISOString())
      .is('deleted_at', null)
      .order('tx_date', { ascending: false });

    if (txError) {
      console.error('[Export] Error fetching transactions:', txError);
      return new Response('Error fetching transactions', { status: 500 });
    }

    // Flatten transaction account names
    const transactionsFormatted = transactions.map((t: any) => ({
      ...t,
      account_name: t.treasury_accounts?.name || t.account_id,
      treasury_accounts: undefined, // Remove nested object
    }));

    // ===== CALCULATE SUMMARY =====
    const summary = calculateExportSummary(
      trades || [],
      payoutsFormatted || [],
      from,
      to,
      month
    );

    // ===== GENERATE CSV =====
    const exportData: ExportData = {
      summary,
      payouts: payoutsFormatted || [],
      transactions: transactionsFormatted || [],
    };

    const csvContent = generateTreasuryExportCsv(exportData);

    // ===== RETURN RESPONSE =====
    const filename = `treasury-export-${month}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Export] Unexpected error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
