/**
 * Treasury Push Notifications
 * Handles threshold-based notifications for payout readiness
 */

import { sendPushToSubscriptions } from '../push/webpush.server';
import { logError, logInfo } from '@/lib/log';

const logTreasuryError = (message: string, error?: unknown) => {
  logError('TreasuryPush', { component: 'treasury.push', message, error: error instanceof Error ? error.message : String(error) });
};

interface ThresholdPushPayload {
  accountId: string;
  accountName: string;
  userId: string;
  cycleStartDate: string; // ISO date string
}

/**
 * Send threshold push notification
 * Called when account reaches balance threshold with retirable > 0
 * Sends push to all user's subscriptions and updates last_threshold_push_cycle_start
 * 
 * Returns true if notification was sent, false if skipped (no subscriptions or no-op)
 */
export async function sendThresholdPush(
  payload: ThresholdPushPayload,
  supabase: any
): Promise<boolean> {
  try {
    const { accountId, accountName, userId, cycleStartDate } = payload;

    // Fetch user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (subError || !subscriptions || subscriptions.length === 0) {
      // No subscriptions - skip notification but don't fail
      logInfo('TreasuryPush', 'No subscriptions for user', { component: 'treasury.push.noSubscriptions', userId });
      return false;
    }

    // Parse subscription JSON
    const parsedSubs = subscriptions
      .map((s: any) => {
        try {
          return typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (parsedSubs.length === 0) {
      logInfo('TreasuryPush', 'No valid subscriptions for user', { component: 'treasury.push.noValidSubscriptions', userId });
      return false;
    }

    // Send push notification
    const notificationPayload = {
      title: '✅ Umbral alcanzado',
      body: `Ya puedes retirar en ${accountName}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `threshold-${accountId}`,
      data: {
        accountId,
        accountName,
        action: 'openTreasuryTab',
        tab: 'cashflow',
      },
    };

    const result = await sendPushToSubscriptions(parsedSubs, notificationPayload);

    if (result.sent > 0) {
      // Update last_threshold_push_cycle_start in treasury_configs
      const { error: updateError } = await supabase
        .from('treasury_configs')
        .update({ last_threshold_push_cycle_start: cycleStartDate })
        .eq('account_id', accountId)
        .eq('user_id', userId);

      if (updateError) {
        await logTreasuryError(
          `[sendThresholdPush] Failed to update cycle_start: ${updateError.message}`,
          updateError
        );
      }

      logInfo('TreasuryPush', 'Sent to subscriptions', { component: 'treasury.push.sent', count: result.sent });
      return true;
    }

    return false;
  } catch (error) {
    await logTreasuryError('[sendThresholdPush] Error:', error);
    return false;
  }
}
