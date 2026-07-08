/**
 * GET /api/cron/business/alerts
 * Scheduled endpoint: runs daily at 00:15 UTC via Supabase Scheduled Edge Function
 *
 * Purpose:
 *   - Check business health metrics and send push alerts
 *   - Low Runway Alert: if estimated runway < 3 months, send push (once per month)
 *   - Annual Report Alert: if current month matches annual_report_due_month, send push (once per year)
 *
 * Logic:
 *   - For each user:
 *     1. Calculate current month metrics (P&L, costs, trades)
 *     2. Calculate runway from last 3 months
 *     3. If runway < 3 months AND last_runway_push_month != current month -> send push
 *     4. If current month == annual_report_due_month AND last_annual_report_push_year != current year -> send push
 *     5. Update tracking fields (last_runway_push_month, last_annual_report_push_year)
 *
 * Security:
 *   - Requires x-cron-secret header matching CRON_SECRET env var
 *   - Uses Supabase service role (admin) access
 *   - Returns 401 if header missing or invalid
 *
 * Environment:
 *   - RUNWAY_THRESHOLD_MONTHS: Threshold for low runway alert (default: 3)
 *   - Push notifications via sendPushToSubscriptions
 */

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sendPushToSubscriptions } from '@/lib/push/webpush.server';
import { getPgClient } from '@/lib/pg/client';
import { logError, logInfo, logWarn } from "@/lib/log";

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface AlertResult {
  user_id: string;
  alert_type: 'low_runway' | 'annual_report';
  sent: boolean;
  subscription_count: number;
  reason?: string;
}

function getMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months.reverse();
}

function calculateRunway(
  trades: any[],
  costs: any[],
  cashReserve: number = 0
): { runwayMonths: number; avgMonthlyBurn: number } {
  const last3Months = getLastNMonths(3);

  // Calculate average monthly costs (burn)
  const last3MonthsCosts = costs.filter((c) => {
    const costMonth = c.cost_date?.substring(0, 7);
    return last3Months.includes(costMonth);
  });

  const totalCosts = last3MonthsCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
  const avgMonthlyBurn = last3Months.length > 0 ? totalCosts / last3Months.length : 0;

  const runwayMonths = avgMonthlyBurn > 0 ? Math.max(0, cashReserve / avgMonthlyBurn) : 0;

  return { runwayMonths, avgMonthlyBurn };
}

export async function GET(request: NextRequest) {
  try {
    // 1) Verify CRON_SECRET header using timing-safe comparison
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    let authorized = false;
    try {
      if (cronSecret && expectedSecret) {
        const cronBuf = Buffer.from(cronSecret);
        const expectedBuf = Buffer.from(expectedSecret);
        authorized = cronBuf.length === expectedBuf.length && timingSafeEqual(cronBuf, expectedBuf);
      }
    } catch {
      authorized = false;
    }

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing cron secret' },
        { status: 401 }
      );
    }

    // 2) Initialize Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 3) Get current month and year
    const now = new Date();
    const currentMonth = getMonthStr();
    const currentMonthInt = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    logInfo("cron.business.alerts", "starting", { currentMonth });

    const results: AlertResult[] = [];

    // 4) Fetch all users with LLC info
    const { data: users, error: usersError } = await supabase
      .from('llc_info')
      .select('user_id, annual_report_due_month, last_annual_report_push_year')
      .is('deleted_at', null);

    if (usersError) {
      logError("CronBusinessAlerts", { component: "cron.business.alerts", message: "Error fetching users:", error: usersError instanceof Error ? usersError.message : String(usersError) });
      return NextResponse.json(
        { error: 'Failed to fetch users', details: usersError },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      logInfo("cron.business.alerts", "no users with LLC info found");
      return NextResponse.json(
        {
          success: true,
          message: 'No users to process',
          results: [],
        },
        { status: 200 }
      );
    }

    // 5) Process each user
    for (const user of users) {
      try {
        const userId = user.user_id;

        // Fetch all trades and costs for this user. trades is in-scope (own
        // Postgres); business_costs/llc_info/push_subscriptions/
        // business_alert_history below are not in the 16-table list and stay
        // on Supabase.
        const pg = getPgClient();
        const { data: tradesRaw, error: tradesError } = await pg
          .from('trades')
          .select('id, exit_date, pnl, account_id')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (tradesError) {
          logWarn("cron.business.alerts", "trades query failed", { userId, error: tradesError.message });
          continue;
        }

        const trades = tradesRaw as unknown as { id: string; exit_date: string | null; pnl: number | null; account_id: string }[] | null;

        const { data: costs, error: costsError } = await supabase
          .from('business_costs')
          .select('id, cost_date, amount')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (costsError) {
          logWarn("cron.business.alerts", "costs query failed", { userId, error: costsError.message });
          continue;
        }

        // Fetch push subscriptions for this user
        const { data: subscriptions, error: subsError } = await supabase
          .from('push_subscriptions')
          .select('subscription')
          .eq('user_id', userId);

        if (subsError) {
          logWarn("cron.business.alerts", "subscriptions query failed", { userId, error: subsError.message });
          continue;
        }

        if (!subscriptions || subscriptions.length === 0) {
          continue; // Skip users without push subscriptions
        }

        const pushSubs = subscriptions
          .map((s) => s.subscription)
          .filter((s) => s) as PushSubscriptionJSON[];

        // LOW RUNWAY ALERT
        const { runwayMonths } = calculateRunway(trades || [], costs || [], 0);
        const runwayThreshold = parseInt(process.env.RUNWAY_THRESHOLD_MONTHS || '3', 10);

        if (runwayMonths < runwayThreshold && runwayMonths >= 0) {
          // Check if we already sent this month
          const { data: lastPush } = await supabase
            .from('business_alert_history')
            .select('alert_month')
            .eq('user_id', userId)
            .eq('alert_type', 'low_runway')
            .eq('alert_month', currentMonth)
            .limit(1);

          if (!lastPush || lastPush.length === 0) {
            // Send push
            const sent = await sendPushToSubscriptions(pushSubs, {
              title: '⚠️ Low Business Runway',
              body: `Your estimated runway is ${runwayMonths.toFixed(1)} months. Review your cash reserves and burn rate.`,
              tag: 'business-low-runway',
              data: {
                type: 'business_alert',
                alert_type: 'low_runway',
                runway_months: runwayMonths.toFixed(1),
              },
            });

            // Record alert sent
            await supabase.from('business_alert_history').insert({
              user_id: userId,
              alert_type: 'low_runway',
              alert_month: currentMonth,
              subscriptions_sent: sent.sent,
            });

            results.push({
              user_id: userId,
              alert_type: 'low_runway',
              sent: sent.sent > 0,
              subscription_count: pushSubs.length,
            });

            logInfo("cron.business.alerts", "low runway alert sent", {
              userId, sent: sent.sent, total: pushSubs.length,
            });
          }
        }

        // ANNUAL REPORT ALERT
        if (currentMonthInt === user.annual_report_due_month) {
          if (user.last_annual_report_push_year !== currentYear) {
            // Send push
            const sent = await sendPushToSubscriptions(pushSubs, {
              title: '📋 Annual Report Due',
              body: `Your LLC annual report is due this month. File before the deadline to avoid penalties.`,
              tag: 'business-annual-report',
              data: {
                type: 'business_alert',
                alert_type: 'annual_report',
              },
            });

            // Update last_annual_report_push_year
            await supabase
              .from('llc_info')
              .update({ last_annual_report_push_year: currentYear })
              .eq('user_id', userId);

            results.push({
              user_id: userId,
              alert_type: 'annual_report',
              sent: sent.sent > 0,
              subscription_count: pushSubs.length,
            });

            logInfo("cron.business.alerts", "annual report alert sent", {
              userId, sent: sent.sent, total: pushSubs.length,
            });
          }
        }
      } catch (error) {
        logError("CronBusinessAlerts", { component: "cron.business.alerts", message: "Error processing user ${user.user_id}:", error: error instanceof Error ? error.message : String(error) });
        continue;
      }
    }

    // 6) Return results
    logInfo("cron.business.alerts", "completed", { alerts: results.length });

    return NextResponse.json(
      {
        success: true,
        message: 'Business alerts completed',
        timestamp: new Date().toISOString(),
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    logError("Business Alerts", { component: "cron.business.alerts", message: "Unexpected error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
