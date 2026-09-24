import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';
import {
  calculateAdvancedMetrics,
  detectTradePatterns,
  calculateSymbolCorrelations,
} from '@/lib/trading/advanced-analytics';

/**
 * GET /api/tradehub/analytics/advanced
 * Fetch advanced trading analytics: metrics, patterns, correlations
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    // Fetch trades
    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte(
        'exit_date',
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order('exit_date', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data: trades, error } = await query;

    if (error) throw error;

    if (!trades || trades.length === 0) {
      return NextResponse.json(
        { metrics: null, patterns: [], correlations: [] },
        {
          headers: {
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
          },
        },
      );
    }

    // Calculate analytics
    const metrics = calculateAdvancedMetrics(trades);
    const patterns = detectTradePatterns(trades);
    const correlations = calculateSymbolCorrelations(trades, 30);

    logInfo('AdvancedAnalyticsAPI', 'Computed advanced analytics', {
      user_id: user.id,
      account_id: accountId,
      trades_count: trades.length,
      patterns_count: patterns.length,
      correlations_count: correlations.length,
    });

    return NextResponse.json(
      {
        metrics,
        patterns: patterns.slice(0, 10),
        correlations: correlations.slice(0, 10),
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (err) {
    logError('AdvancedAnalyticsAPI', 'Failed to compute analytics', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
