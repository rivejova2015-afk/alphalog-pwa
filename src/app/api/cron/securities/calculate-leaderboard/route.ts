import { createServiceClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';
import { NextRequest, NextResponse } from 'next/server';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  email: string;
  xp_total: number;
  modules_completed: number;
  badges_count: number;
}

/**
 * Cron job: Recalculate leaderboard rankings and cache results.
 * Runs every 6 hours to:
 * - Calculate current user rankings based on XP
 * - Count completed modules per user
 * - Count earned badges per user
 * - Cache leaderboard data for fast API responses
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const secret = request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Fetch all users with their securities progress
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id, email')
      .limit(1000);

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, entries: 0, cached: 0 });
    }

    const leaderboardEntries: LeaderboardEntry[] = [];

    // Build leaderboard entries
    for (const user of users) {
      // Get user's total XP
      const { data: progress } = await supabase
        .from('securities_progress')
        .select('xp_total')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      const xpTotal = progress?.xp_total || 0;

      // Count completed modules
      const { count: modulesCompleted } = await supabase
        .from('securities_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true)
        .is('deleted_at', null);

      // Count earned badges
      const { count: badgesCount } = await supabase
        .from('securities_user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      leaderboardEntries.push({
        rank: 0, // Will be set after sorting
        user_id: user.id,
        email: user.email || 'anonymous',
        xp_total: xpTotal,
        modules_completed: modulesCompleted || 0,
        badges_count: badgesCount || 0,
      });
    }

    // Sort by XP (descending) and assign ranks
    leaderboardEntries.sort((a, b) => b.xp_total - a.xp_total);
    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Update leaderboard cache table
    for (const entry of leaderboardEntries) {
      const { error: upsertError } = await supabase.from('securities_leaderboard_cache').upsert(
        {
          user_id: entry.user_id,
          rank: entry.rank,
          email: entry.email,
          xp_total: entry.xp_total,
          modules_completed: entry.modules_completed,
          badges_count: entry.badges_count,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (upsertError) {
        logError('SecurityLeaderboard', 'Failed to cache leaderboard entry', {
          user_id: entry.user_id,
          error: upsertError.message,
        });
      }
    }

    // Top 100 for quick API response
    const top100 = leaderboardEntries.slice(0, 100);
    const { error: topError } = await supabase
      .from('securities_leaderboard_top_100')
      .delete()
      .neq('rank', -1); // Clear old cache

    if (!topError) {
      const { error: insertError } = await supabase
        .from('securities_leaderboard_top_100')
        .insert(
          top100.map((e) => ({
            rank: e.rank,
            user_id: e.user_id,
            email: e.email,
            xp_total: e.xp_total,
            modules_completed: e.modules_completed,
            badges_count: e.badges_count,
          })),
        );

      if (insertError) {
        logError('SecurityLeaderboard', 'Failed to cache top 100', {
          error: insertError.message,
        });
      }
    }

    // Log cache timestamp
    const { error: metaError } = await supabase
      .from('securities_leaderboard_meta')
      .upsert(
        {
          key: 'last_calculated_at',
          value: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );

    if (metaError) {
      logError('SecurityLeaderboard', 'Failed to update metadata', {
        error: metaError.message,
      });
    }

    logInfo('SecurityLeaderboard', `Recalculated leaderboard for ${leaderboardEntries.length} users`, {
      top_user_xp: leaderboardEntries[0]?.xp_total || 0,
      avg_xp: Math.round(leaderboardEntries.reduce((sum, e) => sum + e.xp_total, 0) / leaderboardEntries.length),
    });

    return NextResponse.json({
      success: true,
      entries: leaderboardEntries.length,
      cached_top_100: 100,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logError('SecurityLeaderboard', 'Cron job failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
