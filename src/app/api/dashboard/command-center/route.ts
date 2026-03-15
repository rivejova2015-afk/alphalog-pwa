import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordBugFromRequest } from '@/lib/security/bugRecorder';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const uid = user.id;

    const [
      accounts, trades, setups, evidence,
      decisions, sops, costs, journal,
      bots, botInstances, botCommands, botEvents,
      telemetry, targets, capAccounts,
      appLogs, mailboxes, messages,
      news, calEvents, reports, jobs,
    ] = await Promise.all([
      supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('setups').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('trade_evidence').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('business_decisions').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('business_sops').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('business_costs').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('bots').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('bot_instances').select('id, status, last_heartbeat_at, instance_id, bot_account_id').limit(5),
      supabase.from('bot_commands').select('command_type, status, created_at').eq('created_by', uid).order('created_at', { ascending: false }).limit(5),
      supabase.from('bot_events').select('event_type, payload, created_at').eq('bot_id', uid).order('created_at', { ascending: false }).limit(6),
      supabase.from('bot_telemetry').select('balance, equity, positions_total, positions_buy, positions_sell, basket_r, tier, last_signal_text, last_heartbeat_ts').limit(3),
      supabase.from('intelligence_capital_targets').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('intelligence_capital_accounts').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('app_logs').select('level, area, message, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(6),
      supabase.from('secure_mailboxes').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('secure_messages').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('terminal_news').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('terminal_events').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('terminal_evidence_reports').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('deleted_at', null),
      supabase.from('terminal_report_jobs').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    ]);

    const activeInstances = (botInstances.data ?? []).filter(
      (i) => i.status === 'ACTIVE'
    ).length;

    const payload = {
      snapshot: {
        total_tables: 69,
        rls_enabled: 69,
        total_rows:
          (accounts.count ?? 0) + (trades.count ?? 0) + (setups.count ?? 0) +
          (decisions.count ?? 0) + (journal.count ?? 0),
        db_size: '19 MB',
      },
      trading: {
        accounts: accounts.count ?? 0,
        trades: trades.count ?? 0,
        setups: setups.count ?? 0,
        evidence: evidence.count ?? 0,
      },
      business: {
        decisions: decisions.count ?? 0,
        sops: sops.count ?? 0,
        costs: costs.count ?? 0,
        journal: journal.count ?? 0,
      },
      bot: {
        bots: bots.count ?? 0,
        instances: (botInstances.data ?? []).length,
        active: activeInstances,
        commands: botCommands.data?.length ?? 0,
        events: botEvents.data?.length ?? 0,
        telemetry: telemetry.data?.length ?? 0,
      },
      intelligence: {
        targets: targets.count ?? 0,
        accounts: capAccounts.count ?? 0,
      },
      security: {
        app_logs: appLogs.data?.length ?? 0,
        mailboxes: mailboxes.count ?? 0,
        messages: messages.count ?? 0,
      },
      terminal: {
        news: news.count ?? 0,
        calendar: calEvents.count ?? 0,
        reports: reports.count ?? 0,
        jobs: jobs.count ?? 0,
      },
      bot_events: botEvents.data ?? [],
      app_logs: appLogs.data ?? [],
      bot_commands: botCommands.data ?? [],
      bot_instances: botInstances.data ?? [],
      telemetry: telemetry.data ?? [],
    };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    await recordBugFromRequest(request, { userId: null, status: 500, error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
