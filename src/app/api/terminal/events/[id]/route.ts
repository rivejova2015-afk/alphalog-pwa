// src/app/api/terminal/events/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/log";

/**
 * PATCH /api/terminal/events/{id}
 * Update calendar event
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, impact, timestamp_utc } = body;

    // Verify ownership
    const { data: existingEvent } = await supabase
      .from("terminal_events")
      .select("user_id, name, impact, timestamp_utc")
      .eq("id", id)
      .single();

    if (!existingEvent || existingEvent.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Event not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_events")
      .update({
        name: name !== undefined ? encryptText(name) : existingEvent.name,
        impact: impact !== undefined ? impact : existingEvent.impact,
        timestamp_utc: timestamp_utc !== undefined ? timestamp_utc : existingEvent.timestamp_utc,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logError("TerminalEvents", { component: "terminal.events.[id]", message: "Error updating event:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to update event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...data,
      name: decryptText(data.name),
    });
  } catch (err: unknown) {
    logError("TerminalEvents", { component: "terminal.events.[id]", message: "Error in PATCH /api/terminal/events/[id]:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/terminal/events/{id}
 * Hard-delete calendar event
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const { data: existingEvent } = await supabase
      .from("terminal_events")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existingEvent || existingEvent.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Event not found or unauthorized" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("terminal_events")
      .delete()
      .eq("id", id)
      .eq("user_id", userData.user.id);

    if (error) {
      logError("TerminalEvents", { component: "terminal.events.[id]", message: "Error deleting event:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to delete event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    logError("TerminalEvents", { component: "terminal.events.[id]", message: "Error in DELETE /api/terminal/events/[id]:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
