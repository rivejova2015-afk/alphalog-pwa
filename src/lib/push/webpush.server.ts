// src/lib/push/webpush.server.ts
// Server-side push notification helper using web-push

import webpush from 'web-push';
import { logError, logWarn } from '@/lib/log';

// Initialize VAPID keys from environment
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPrivateKey && vapidPublicKey) {
  try {
    webpush.setVapidDetails(
      vapidSubject || 'mailto:support@alphalog.io',
      vapidPublicKey,
      vapidPrivateKey
    );
  } catch (error) {
    logError('WebPush', { component: 'push.webpush.vapid', message: 'Failed to set VAPID details', error: error instanceof Error ? error.message : String(error) });
  }
}

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, string>;
}

/**
 * Sends push notification to a single subscription
 */
export async function sendPushToSubscription(
  subscription: PushSubscriptionJSON,
  payload: PushNotificationPayload
): Promise<void> {
  if (!vapidPrivateKey || !vapidPublicKey) {
    logWarn('WebPush', 'Push notifications disabled: VAPID keys not configured', { component: 'push.webpush.disabled.single' });
    return;
  }

  try {
    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/icon-192.png',
      tag: payload.tag || 'alphalog-notification',
      data: payload.data || {},
    });

    await webpush.sendNotification(subscription, message);
  } catch (error) {
    if (error instanceof webpush.WebPushError) {
      if (error.statusCode === 410) {
        // Subscription expired/invalid - should be deleted
        throw new Error('SUBSCRIPTION_EXPIRED');
      }
      if (error.statusCode === 404) {
        // Endpoint not found
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }
      // Other WebPush errors
      logError('WebPush', { component: 'push.webpush.sendError', message: 'WebPush error', status: error.statusCode, error: error.message });
      throw error;
    }
    throw error;
  }
}

/**
 * Sends push notification to multiple subscriptions
 * Logs errors but doesn't throw (fire-and-forget pattern)
 */
export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionJSON[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidPrivateKey || !vapidPublicKey) {
    logWarn('WebPush', 'Push notifications disabled: VAPID keys not configured', { component: 'push.webpush.disabled.batch' });
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const promises = subscriptions.map((subscription) =>
    sendPushToSubscription(subscription, payload)
      .then(() => {
        sent++;
      })
      .catch((error) => {
        failed++;
        if (error.message === 'SUBSCRIPTION_EXPIRED') {
          // Log for cleanup (optional: could queue deletion)
          logWarn('WebPush', 'Subscription expired for endpoint', { component: 'push.webpush.subscriptionExpired' });
        } else {
          logError('WebPush', { component: 'push.webpush.sendFailed', message: 'Failed to send push', error: error.message });
        }
      })
  );

  await Promise.all(promises);

  return { sent, failed };
}

export function getVapidPublicKey(): string {
  if (!vapidPublicKey) {
    throw new Error('VAPID public key not configured');
  }
  return vapidPublicKey;
}
