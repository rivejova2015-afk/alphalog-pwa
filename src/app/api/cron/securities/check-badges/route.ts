import { createServiceClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Cron job: Check badge conditions and award badges to qualifying users.
 * Runs daily to evaluate if users meet badge trigger conditions.
 *
 * Trigger conditions include:
 * - Completing all modules in a track
 * - Achieving high quiz scores
 * - Solving exercises without hints
 * - Maintaining study streaks
 * - Earning other badges first (chained badges)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const secret = request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    let badgesAwarded = 0;

    // Fetch all badge definitions
    const { data: badges, error: badgesError } = await supabase
      .from('securities_badges')
      .select('*')
      .is('deleted_at', null);

    if (badgesError) throw badgesError;
    if (!badges || badges.length === 0) {
      logInfo('SecurityBadges', 'No badges to process');
      return NextResponse.json({ success: true, awarded: 0 });
    }

    // Fetch all users
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1000);

    if (usersError) throw usersError;
    if (!users) {
      return NextResponse.json({ success: true, awarded: 0 });
    }

    // For each badge and user combination, check if user qualifies
    for (const badge of badges) {
      for (const user of users) {
        // Check if user already has this badge
        const { data: existingBadge } = await supabase
          .from('securities_user_badges')
          .select('id')
          .eq('user_id', user.id)
          .eq('badge_id', badge.id)
          .is('deleted_at', null)
          .single();

        if (existingBadge) continue; // Already has badge

        // Parse trigger condition and check if met
        let shouldAward = false;
        const condition = badge.trigger_condition.toLowerCase();

        if (condition.includes('complete all modules')) {
          // Check if user completed all 86 modules
          const { count } = await supabase
            .from('securities_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('completed', true)
            .is('deleted_at', null);

          shouldAward = count === 86;
        } else if (condition.includes('quiz') && condition.includes('100')) {
          // Check if user has perfect quiz scores
          const { data: quizzes } = await supabase
            .from('securities_quiz_results')
            .select('score')
            .eq('user_id', user.id)
            .is('deleted_at', null);

          shouldAward = quizzes && quizzes.length > 5 && quizzes.every((q) => q.score === 100);
        } else if (condition.includes('solve') && condition.includes('without hints')) {
          // Check if user solved 10+ exercises without using hints
          const { count } = await supabase
            .from('securities_exercise_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('used_hints', false)
            .eq('passed', true)
            .is('deleted_at', null);

          shouldAward = (count || 0) >= 10;
        } else if (condition.includes('streak')) {
          // Check if user has 30+ day streak
          const { data: progress } = await supabase
            .from('securities_progress')
            .select('streak_days')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .single();

          shouldAward = (progress?.streak_days || 0) >= 30;
        }

        // Award badge if conditions met
        if (shouldAward) {
          const { error: insertError } = await supabase.from('securities_user_badges').insert({
            user_id: user.id,
            badge_id: badge.id,
            earned_at: new Date().toISOString(),
          });

          if (insertError) {
            logError('SecurityBadges', 'Failed to award badge', {
              user_id: user.id,
              badge_id: badge.id,
              error: insertError.message,
            });
          } else {
            badgesAwarded++;

            // Award XP for badge
            const { error: xpError } = await supabase.rpc('add_security_xp', {
              p_user_id: user.id,
              p_amount: badge.xp_reward || 0,
              p_reason: `Earned badge: ${badge.name}`,
            });

            if (xpError) {
              logError('SecurityBadges', 'Failed to award XP', {
                user_id: user.id,
                error: xpError.message,
              });
            }
          }
        }
      }
    }

    logInfo('SecurityBadges', `Awarded ${badgesAwarded} badges`, { count: badgesAwarded });
    return NextResponse.json({ success: true, awarded: badgesAwarded });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logError('SecurityBadges', 'Cron job failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
