/**
 * GET /api/cron/treasury/withdrawal-reminders
 * Scheduled endpoint: runs daily at 00:05 UTC via Supabase Scheduled Edge Function
 * 
 * Purpose:
 *   - Identify withdrawal days and calendar events for today (UTC)
 *   - Send push notifications to users with active subscriptions
 *   - Track sent notifications to prevent duplicates (cooldown per cycle)
 * 
 * Security:
 *   - Requires x-cron-secret header matching CRON_SECRET env var
 *   - Returns 401 if header missing or invalid
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { computeCycleStart } from '@/lib/treasury/payoutEngine';
import { sendPushToSubscriptions } from '@/lib/push/webpush.server';

// Type for push subscription
type PushSubscription = {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
};

// Helper to format UTC date as YYYY-MM-DD
function getUTCDateString(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse date string to Date at UTC midnight
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

interface UserWithPush {
  id: string;
  email?: string;
  has_subscription: boolean;
}

interface AccountConfig {
  id: string;
  user_id: string;
  account_id: string;
  withdrawal_day: number;
  push_withdrawal_day_enabled: boolean;
  last_withdrawal_push_cycle_start: string | null;
  account_display_name?: string; // Flattened from accounts relation
}

interface CalendarEvent {
  user_id: string;
  account_id: string;
  event_date: string;
  title: string;
  push_enabled: boolean;
  account_display_name?: string; // Flattened from accounts relation
}

export async function GET(request: NextRequest) {
  try {
    // 1) Verify CRON_SECRET header
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
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

    // 3) Get today's date in UTC
    const todayUTC = getUTCDateString();
    const today = parseDateString(todayUTC);

    console.log(`[Treasury Withdrawal Reminders] Starting at ${todayUTC}`);

    // 4) Get users with active push subscriptions
    const { data: usersWithPush, error: userError } = await supabase
      .from('push_subscriptions')
      .select('user_id, auth.users!inner(id, email)', { count: 'exact' })
      .eq('deleted_at', null)
      .returns<{ user_id: string; auth: { users: { id: string; email?: string } } }[]>();

    if (userError) {
      console.error('Error fetching users with push subscriptions:', userError);
      return NextResponse.json(
        { error: 'Database query failed', details: userError.message },
        { status: 500 }
      );
    }

    if (!usersWithPush || usersWithPush.length === 0) {
      console.log('[Treasury Withdrawal Reminders] No users with push subscriptions');
      return NextResponse.json({
        status: 'success',
        message: 'No users with active subscriptions',
        processed: 0,
      });
    }

    const uniqueUserIds = [...new Set(usersWithPush.map((u) => u.user_id))];
    console.log(
      `[Treasury Withdrawal Reminders] Processing ${uniqueUserIds.length} users with active subscriptions`
    );

    let sentNotifications = 0;
    const errors: string[] = [];

    // 5) For each user, check withdrawal days and calendar events
    for (const userId of uniqueUserIds) {
      try {
        // Fetch user's treasury configs
        const { data: configs, error: configError } = await supabase
          .from('treasury_configs')
          .select(
            `
            id,
            user_id,
            account_id,
            withdrawal_day,
            push_withdrawal_day_enabled,
            last_withdrawal_push_cycle_start
          `
          )
          .eq('user_id', userId)
          .eq('deleted_at', null)
          .returns<AccountConfig[]>();

        if (configError) {
          console.error(`Error fetching configs for user ${userId}:`, configError);
          errors.push(`Config query failed for user ${userId}`);
          continue;
        }

        if (!configs || configs.length === 0) {
          console.log(`User ${userId}: No treasury configs found`);
          continue;
        }

        // Fetch user's calendar events for today
        const { data: todayEvents, error: eventError } = await supabase
          .from('treasury_calendar_events')
          .select(
            `
            user_id,
            account_id,
            event_date,
            title,
            push_enabled
          `
          )
          .eq('user_id', userId)
          .eq('event_date', todayUTC)
          .eq('deleted_at', null)
          .returns<CalendarEvent[]>();

        if (eventError) {
          console.error(`Error fetching calendar events for user ${userId}:`, eventError);
          errors.push(`Event query failed for user ${userId}`);
          continue;
        }

        // Collect notifications to send for this user
        const notificationsToSend: Array<{
          accountId: string;
          accountName?: string;
          reason: string;
          cycleStart: string;
        }> = [];

        // Check withdrawal days
        for (const config of configs) {
          const withdrawalDay = config.withdrawal_day;
          const pushEnabled = config.push_withdrawal_day_enabled;
          const lastPushCycleStart = config.last_withdrawal_push_cycle_start;

          // Check if today is withdrawal day
          const todayDayOfMonth = today.getUTCDate();
          if (todayDayOfMonth === withdrawalDay && pushEnabled) {
            // Compute cycle start to check for cooldown
            const cycleStart = computeCycleStart(withdrawalDay, today);
            const cycleStartStr = getUTCDateString(cycleStart);

            // Check if we already sent a push for this cycle
            if (lastPushCycleStart !== cycleStartStr) {
              notificationsToSend.push({
                accountId: config.account_id,
                accountName: config.account_display_name,
                reason: `Withdrawal day reminder (day ${withdrawalDay})`,
                cycleStart: cycleStartStr,
              });
            } else {
              console.log(
                `User ${userId} / Account ${config.account_id}: Already sent withdrawal push for cycle ${cycleStartStr}`
              );
            }
          }
        }

        // Check custom calendar events for today
        if (todayEvents && todayEvents.length > 0) {
          for (const event of todayEvents) {
            if (event.push_enabled) {
              notificationsToSend.push({
                accountId: event.account_id,
                accountName: event.account_display_name,
                reason: `Event: ${event.title}`,
                cycleStart: todayUTC,
              });
            }
          }
        }

        // 6) Send notifications and update tracking
        for (const notification of notificationsToSend) {
          try {
            // Prepare push payload
            const title = 'Día de Retiro';
            const body = notification.accountName
              ? `${notification.accountName}: ${notification.reason}`
              : notification.reason;
            const tag = `treasury_withdrawal_${notification.accountId}`;

            // Send via webpush to all subscriptions for this user
            const { data: subs, error: subError } = await supabase
              .from('push_subscriptions')
              .select('subscription_json')
              .eq('user_id', userId)
              .eq('deleted_at', null)
              .returns<{ subscription_json: Record<string, unknown> }[]>();

            if (subError) {
              console.error(`Error fetching subscriptions for user ${userId}:`, subError);
              errors.push(`Subscription query failed for user ${userId}`);
              continue;
            }

            if (!subs || subs.length === 0) {
              console.log(`User ${userId}: No push subscriptions found`);
              continue;
            }

            // Send to all subscriptions
            let pushSent = false;
            for (const sub of subs) {
              try {
                await sendPushToSubscriptions([sub.subscription_json as PushSubscription], {
                  title,
                  body,
                  icon: '/icon-192x192.png',
                  badge: '/badge-72x72.png',
                  tag,
                  data: {
                    url: '/dashboard/treasury?tab=calendario',
                    accountId: notification.accountId,
                  },
                });
                pushSent = true;
              } catch (pushError) {
                console.error(`Error sending push to subscription:`, pushError);
                // Continue with next subscription
              }
            }

            // Update tracking only if push was successfully sent
            if (pushSent) {
              // Update last_withdrawal_push_cycle_start in treasury_configs
              const { error: updateError } = await supabase
                .from('treasury_configs')
                .update({ last_withdrawal_push_cycle_start: notification.cycleStart })
                .eq('user_id', userId)
                .eq('account_id', notification.accountId)
                .eq('deleted_at', null);

              if (updateError) {
                console.error(
                  `Error updating cycle start for user ${userId}:`,
                  updateError
                );
              } else {
                sentNotifications++;
                console.log(
                  `Sent notification to user ${userId} / Account ${notification.accountId}: ${notification.reason}`
                );
              }
            }
          } catch (notifError) {
            console.error('Error processing notification:', notifError);
            errors.push(`Notification failed: ${String(notifError)}`);
          }
        }
      } catch (userProcessError) {
        console.error(`Error processing user ${userId}:`, userProcessError);
        errors.push(`User processing failed: ${String(userProcessError)}`);
      }
    }

    console.log(
      `[Treasury Withdrawal Reminders] Completed: ${sentNotifications} notifications sent, ${errors.length} errors`
    );

    return NextResponse.json({
      status: 'success',
      message: 'Withdrawal reminder job completed',
      processed: uniqueUserIds.length,
      sent: sentNotifications,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: todayUTC,
    });
  } catch (error) {
    console.error('[Treasury Withdrawal Reminders] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
