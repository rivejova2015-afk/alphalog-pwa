/**
 * PATCH /api/treasury/calendar-events/[id]
 * DELETE /api/treasury/calendar-events/[id]
 * 
 * Purpose:
 *   - PATCH: Update a calendar event
 *   - DELETE: Soft-delete a calendar event
 * 
 * Security: RLS enforced (owner-only)
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Update event (RLS ensures user_id matches)
    const { data: event, error } = await supabase
      .from('treasury_calendar_events')
      .update(body)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('Error updating calendar event:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found or not owned by user' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('PATCH /api/treasury/calendar-events/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Soft-delete event (set deleted_at = NOW())
    const { data: event, error } = await supabase
      .from('treasury_calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('Error deleting calendar event:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found or not owned by user' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: event.id });
  } catch (error) {
    console.error('DELETE /api/treasury/calendar-events/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
