import { createClient } from '@supabase/supabase-js';
import { getPgClient } from '@/lib/pg/client';
import { getMonthDateRange, calculateExportSummary, generateTreasuryExportCsv, type ExportData } from '@/lib/treasury/exportCsv';
import {
  exportMonthSchema,
  validateDateRange,
  validateExportSize,
  validateRecordCount,
  generateExportFilename,
  logExportEvent,
  exportErrorResponse,
  exportSuccessResponse,
  EXPORT_CONFIG,
} from '@/lib/security/exportHardening';
import { logAuditEvent } from '@/lib/security/auditLog';
import { requireFreshStepUpFromToken } from '@/lib/security/stepUp';
import { recordBugFromRequest } from '@/lib/security/bugRecorder';
import { asArray } from '@/lib/validation/nullGuards';
import { logError } from "@/lib/log";

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
  const ipHint = request.headers.get('x-forwarded-for') || 'unknown';

  try {
    // Get month parameter
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Validate month format with schema
    const validation = exportMonthSchema.safeParse({ month });
    if (!validation.success) {
      await logExportEvent(
        {
          userId: "unknown",
          resourceType: "treasury",
          format: "csv",
          status: "blocked",
          reason: "Invalid month format",
          ipHint,
        },
        logAuditEvent
      );

      return exportErrorResponse('Invalid month format. Use YYYY-MM (e.g., 2026-01)', 400);
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return exportErrorResponse('Unauthorized: No session', 401);
    }

    // Verify session
    const token = authHeader.substring(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return exportErrorResponse('Unauthorized: Invalid session', 401);
    }

    const userId = user.id;

    // SECURITY (audit 2026-06, Área 13): data export requires a recent MFA step-up.
    const stepUp = requireFreshStepUpFromToken(token);
    if (!stepUp.ok) {
      return Response.json(
        { error: "step_up_required", reason: stepUp.reason },
        { status: stepUp.status }
      );
    }

    const { month: monthStr } = validation.data;

    // Get date range for month
    const { from, to } = getMonthDateRange(monthStr);

    // Validate date range
    const rangeValidation = validateDateRange(from.toISOString(), to.toISOString());
    if (!rangeValidation.valid) {
      await logExportEvent(
        {
          userId,
          resourceType: "treasury",
          format: "csv",
          status: "blocked",
          reason: rangeValidation.error,
          ipHint,
        },
        logAuditEvent
      );

      return exportErrorResponse(rangeValidation.error || "Invalid date range", 400);
    }

    // ===== FETCH DATA =====

    // Fetch trades (for PnL calculation). trades is in-scope (own Postgres);
    // the shim has no `.gte()`/`.lte()`, so fetch the user's rows and filter
    // the [from, to] window in JS. Both sides of the comparison are wrapped
    // in `new Date(...).getTime()` — the pg driver auto-parses `updated_at`
    // (timestamptz) into a native Date at runtime, and a bare `Date >= string`
    // comparison silently always evaluates false.
    const pg = getPgClient();
    const { data: tradesRaw, error: tradesError } = await pg
      .from('trades')
      .select('id, status, pnl, pnl_percent, closed_at, updated_at')
      .eq('user_id', userId);

    if (tradesError) {
      logError("Export", { component: "treasury.export", message: "Error fetching trades:", error: tradesError instanceof Error ? tradesError.message : String(tradesError) });
      await recordBugFromRequest(request, {
        userId,
        status: 500,
        error: tradesError,
        payload: { month: monthStr, scope: "trades" },
      });
      return new Response('Error fetching trades', { status: 500 });
    }

    const fromMs = from.getTime();
    const toMs = to.getTime();
    const trades = ((tradesRaw ?? []) as unknown as {
      id: string; status: string; pnl: number | null; pnl_percent: number | null;
      closed_at: string | Date | null; updated_at: string | Date;
    }[]).filter((t) => {
      const updatedMs = new Date(t.updated_at).getTime();
      return updatedMs >= fromMs && updatedMs <= toMs;
    });

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
      logError("Export", { component: "treasury.export", message: "Error fetching payouts:", error: payoutsError instanceof Error ? payoutsError.message : String(payoutsError) });
      await recordBugFromRequest(request, {
        userId,
        status: 500,
        error: payoutsError,
        payload: { month: monthStr, scope: "payouts" },
      });
      return new Response('Error fetching payouts', { status: 500 });
    }

    // Flatten payout account names
    const payoutsFormatted = asArray<any>(payouts).map((p) => ({
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
      logError("Export", { component: "treasury.export", message: "Error fetching transactions:", error: txError instanceof Error ? txError.message : String(txError) });
      await recordBugFromRequest(request, {
        userId,
        status: 500,
        error: txError,
        payload: { month: monthStr, scope: "transactions" },
      });
      return new Response('Error fetching transactions', { status: 500 });
    }

    // Flatten transaction account names
    const transactionsFormatted = asArray<any>(transactions).map((t) => ({
      ...t,
      account_name: t.treasury_accounts?.name || t.account_id,
      treasury_accounts: undefined, // Remove nested object
    }));

    // ===== CALCULATE SUMMARY =====
    const summary = calculateExportSummary(
      asArray(trades),
      payoutsFormatted,
      from,
      to,
      monthStr
    );

    // ===== VALIDATE RECORD COUNTS =====
    const totalRecords = asArray(trades).length + payoutsFormatted.length + transactionsFormatted.length;
    const recordValidation = validateRecordCount(Array(totalRecords).fill({}));
    if (!recordValidation.valid) {
      await logExportEvent(
        {
          userId,
          resourceType: "treasury",
          format: "csv",
          recordCount: totalRecords,
          status: "blocked",
          reason: recordValidation.error,
          ipHint,
        },
        logAuditEvent
      );

      return exportErrorResponse(recordValidation.error || "Export data too large", 400);
    }

    // ===== GENERATE CSV =====
    const exportData: ExportData = {
      summary,
      payouts: payoutsFormatted || [],
      transactions: transactionsFormatted || [],
    };

    const csvContent = generateTreasuryExportCsv(exportData);

    // ===== VALIDATE FILE SIZE =====
    const sizeValidation = validateExportSize(csvContent);
    if (!sizeValidation.valid) {
      await logExportEvent(
        {
          userId,
          resourceType: "treasury",
          format: "csv",
          recordCount: totalRecords,
          fileSizeMB: sizeValidation.sizeMB,
          status: "blocked",
          reason: sizeValidation.error,
          ipHint,
        },
        logAuditEvent
      );

      return exportErrorResponse(sizeValidation.error || "Export file too large", 400);
    }

    // ===== RETURN RESPONSE =====
    const filename = generateExportFilename("treasury", "csv", monthStr);

    // Log successful export
    await logExportEvent(
      {
        userId,
        resourceType: "treasury",
        format: "csv",
        recordCount: totalRecords,
        fileSizeMB: sizeValidation.sizeMB,
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10),
        status: "success",
        ipHint,
      },
      logAuditEvent
    );

    return exportSuccessResponse(csvContent, "csv", filename);
  } catch (error) {
    logError("Export", { component: "treasury.export", message: "Unexpected error:", error: error instanceof Error ? error.message : String(error) });
    await recordBugFromRequest(request, {
      userId: "unknown",
      status: 500,
      error,
    });
    return exportErrorResponse('Internal server error', 500);
  }
}
