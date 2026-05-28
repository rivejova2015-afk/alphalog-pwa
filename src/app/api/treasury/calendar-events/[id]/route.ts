/**
 * PATCH /api/treasury/calendar-events/[id]
 * DELETE /api/treasury/calendar-events/[id]
 *
 * Security: RLS enforced (owner-only), SSR cookie-based auth
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logError } from "@/lib/log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { data: event, error } = await supabase
      .from('treasury_calendar_events')
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      logError("TreasuryCalendarEvents", { component: "treasury.calendar-events.[id]", message: "Error updating calendar event:", error: error instanceof Error ? error.message : String(error) });
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found or not owned by user' },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    return NextResponse.json(event);
  } catch (error) {
    logError("TreasuryCalendarEvents", { component: "treasury.calendar-events.[id]", message: "PATCH /api/treasury/calendar-events/[id] error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: event, error } = await supabase
      .from('treasury_calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      logError("TreasuryCalendarEvents", { component: "treasury.calendar-events.[id]", message: "Error deleting calendar event:", error: error instanceof Error ? error.message : String(error) });
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found or not owned by user' },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: event.id });
  } catch (error) {
    logError("TreasuryCalendarEvents", { component: "treasury.calendar-events.[id]", message: "DELETE /api/treasury/calendar-events/[id] error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
