/**
 * POST /api/ops/cron/polyarb-daily-report
 * Schedule: 10pm daily (0 22 * * *)
 *
 * Generates daily P&L summary for all active PolyArb agents.
 * Sends push notification with summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateBearerToken } from '@/lib/security/timing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validateCronSecret(request: NextRequest) {
  return validateBearerToken(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
    'OPS_CRON_SECRET',
  );
}

export async function POST(request: NextRequest) {
  const auth = validateCronSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status as number });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Missing config' }, { status: 500 });

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Get all agents (not deleted)
  const { data: agents } = await supabase
    .from('polyarb_agents')
    .select('id, user_id, name, status, starting_capital_usd')
    .is('deleted_at', null);

  if (!agents || agents.length === 0) {
    return NextResponse.json({ ok: true, reports: 0 });
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  for (const agent of agents) {
    // Get today's trades
    const { data: trades } = await supabase
      .from('polyarb_trades')
      .select('price, size, fee_usd, status, side')
      .eq('agent_id', agent.id)
      .gte('executed_at', todayStart.toISOString())
      .eq('status', 'FILLED');

    // Get today's closed positions
    const { data: closedPositions } = await supabase
      .from('polyarb_positions')
      .select('pnl_usd, pnl_percent, exit_reason')
      .eq('agent_id', agent.id)
      .gte('closed_at', todayStart.toISOString())
      .in('status', ['CLOSED', 'LIQUIDATED']);

    // Get latest telemetry
    const { data: telemetry } = await supabase
      .from('polyarb_telemetry')
      .select('equity_usd, total_pnl_usd, win_rate, max_drawdown_pct')
      .eq('agent_id', agent.id)
      .single();

    const tradeCount = trades?.length ?? 0;
    const closedCount = closedPositions?.length ?? 0;
    const totalPnl = closedPositions?.reduce((s, p) => s + (Number(p.pnl_usd) || 0), 0) ?? 0;
    const wins = closedPositions?.filter(p => (Number(p.pnl_usd) || 0) > 0).length ?? 0;
    const equity = telemetry?.equity_usd ?? agent.starting_capital_usd;

    const summary = [
      `PolyArb Daily Report: ${agent.name}`,
      `Status: ${agent.status}`,
      `Equity: $${Number(equity).toFixed(2)}`,
      `Today P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`,
      `Trades: ${tradeCount} executed, ${closedCount} closed (${wins} wins)`,
      `Win Rate: ${telemetry?.win_rate ?? 'N/A'}%`,
      `Max Drawdown: ${telemetry?.max_drawdown_pct ?? 'N/A'}%`,
    ].join('\n');

    // Log to app_logs
    await supabase.from('app_logs').insert({
      user_id: agent.user_id,
      level: 'info',
      area: 'polyarb_daily_report',
      message: summary,
      meta: {
        agent_id: agent.id,
        equity,
        today_pnl: totalPnl,
        trade_count: tradeCount,
        closed_count: closedCount,
        wins,
      },
    });

    // Push notification
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://alphalog.io';
      await fetch(`${appUrl}/api/push/notify-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: agent.user_id,
          title: `PolyArb: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} today`,
          body: `${tradeCount} trades, ${wins}/${closedCount} wins. Equity: $${Number(equity).toFixed(2)}`,
        }),
      });
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({ ok: true, reports: agents.length });
}
