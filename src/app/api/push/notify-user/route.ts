// src/app/api/push/notify-user/route.ts
// Server-side utility to send push to a user (called by internal triggers)
// Note: This is used by report generation and goal completion endpoints

import { sendPushToSubscriptions } from '@/lib/push/webpush.server';
import { NextRequest, NextResponse } from 'next/server';

// Ensure Node.js runtime for compatibility with web-push and Supabase client
export const runtime = 'nodejs';
// Force dynamic to prevent build-time static evaluation (avoids env checks during Turbopack build)
export const dynamic = 'force-dynamic';

interface NotifyUserPayload {
  userId: string;
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, string>;
}

/**
 * Send push notification to user's all subscriptions
 * Called by report generation, goal completion, etc.
 * Requires internal auth (service role key)
 */
export async function POST(request: NextRequest) {
  try {
    const payload: NotifyUserPayload = await request.json();

    const { userId, title, body, tag, data } = payload;

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, body' },
        { status: 400 }
      );
    }

    // Verify request is from server (has authorization header)
    // In production, use service role key or internal header validation
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create Supabase client at runtime (safe for build)
    // Uses CommonJS require module (lazy-client.js) to prevent Turbopack static analysis
    let supabase;
    try {
      // Lazy import of CommonJS module prevents build-time evaluation
      const { getSupabaseClient } = await import('@/lib/supabase/lazy-client.js');
      supabase = getSupabaseClient();
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      return NextResponse.json(
        { error: 'Service unavailable: missing configuration' },
        { status: 500 }
      );
    }

    // Fetch all subscriptions for user
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Failed to fetch subscriptions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No subscriptions found for user',
      });
    }

    // Convert to PushSubscriptionJSON format
    const pushSubscriptions = subscriptions.map((sub) => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    }));

    // Send to all subscriptions
    const result = await sendPushToSubscriptions(pushSubscriptions, {
      title,
      body,
      tag: tag || 'alphalog-notification',
      data: data || {},
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error('Notify user endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
