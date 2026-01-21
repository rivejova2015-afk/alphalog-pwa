/**
 * GET /api/treasury/calendar-events
 * POST /api/treasury/calendar-events
 * 
 * Purpose:
 *   - GET: List all calendar events for the authenticated user (filter by month optional)
 *   - POST: Create a new calendar event
 * 
 * Security: RLS enforced (owner-only)
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    // Get session from request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring('Bearer '.length);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query parameters
    const accountId = request.nextUrl.searchParams.get('accountId');
    const from = request.nextUrl.searchParams.get('from'); // YYYY-MM-DD
    const to = request.nextUrl.searchParams.get('to'); // YYYY-MM-DD

    // Build query
    let query = supabase
      .from('treasury_calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('deleted_at', null)
      .order('event_date', { ascending: true });

    // Apply filters
    if (accountId) {
      query = query.eq('account_id', accountId);
    }
    if (from) {
      query = query.gte('event_date', from);
    }
    if (to) {
      query = query.lte('event_date', to);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching calendar events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    return NextResponse.json(events || []);
  } catch (error) {
    console.error('GET /api/treasury/calendar-events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    // Get session from request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring('Bearer '.length);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { account_id, event_date, title, kind, push_enabled } = body;

    // Validate inputs
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
      .eq('deleted_at', null)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found or not owned by user' },
        { status: 404 }
      );
    }

    // Create event
    const { data: event, error } = await supabase
      .from('treasury_calendar_events')
      .insert([
        {
          user_id: user.id,
          account_id,
          event_date,
          title,
          kind: kind || 'note',
          push_enabled: push_enabled !== false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating calendar event:', error);
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Event already exists for this date and type' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('POST /api/treasury/calendar-events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
