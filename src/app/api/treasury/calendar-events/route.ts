/**
 * GET /api/treasury/calendar-events
 * POST /api/treasury/calendar-events
 *
 * Purpose:
 *   - GET: List all calendar events for the authenticated user (filter by month optional)
 *   - POST: Create a new calendar event
 *
 * Security: RLS enforced (owner-only), SSR cookie-based auth
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/log';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = request.nextUrl.searchParams.get('accountId');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    let query = supabase
      .from('treasury_calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('event_date', { ascending: true });

    if (accountId) query = query.eq('account_id', accountId);
    if (from) query = query.gte('event_date', from);
    if (to) query = query.lte('event_date', to);

    const { data: events, error } = await query;

    if (error) {
      logError('TreasuryCalendar', { component: 'GET', message: 'Fetch error', error: error.message });
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json(events || [], {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    logError('TreasuryCalendar', { component: 'GET', message: 'Unexpected error', error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { account_id, event_date, title, kind, push_enabled } = body;

    if (!account_id || !event_date || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, event_date, title' },
        { status: 400 }
      );
    }

    // Verify account ownership
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found or not owned by user' },
        { status: 404 }
      );
    }

    const { data: event, error } = await supabase
      .from('treasury_calendar_events')
      .insert([{
        user_id: user.id,
        account_id,
        event_date,
        title,
        kind: kind || 'note',
        push_enabled: push_enabled !== false,
      }])
      .select()
      .single();

    if (error) {
      logError('TreasuryCalendar', { component: 'POST', message: 'Create error', error: error.message });
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Event already exists for this date and type' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    logError('TreasuryCalendar', { component: 'POST', message: 'Unexpected error', error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
