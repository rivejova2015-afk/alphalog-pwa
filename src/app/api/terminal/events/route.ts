// src/app/api/terminal/events/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/terminal/events?instrumentId={id}
 * Returns calendar events for a specific instrument
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instrumentId = request.nextUrl.searchParams.get("instrumentId");
    if (!instrumentId) {
      return NextResponse.json(
        { error: "instrumentId is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_events")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("instrument_id", instrumentId)
      .is("deleted_at", null)
      .order("timestamp_utc", { ascending: true });

    if (error) {
      console.error("Error fetching events:", error);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    console.error("Error in GET /api/terminal/events:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/terminal/events
 * Create calendar event
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instrumentId, name, impact, timestamp_utc } = body;

    if (!instrumentId || !name?.trim() || !timestamp_utc) {
      return NextResponse.json(
        {
          error: "Missing required fields: instrumentId, name, timestamp_utc",
        },
        { status: 400 }
      );
    }

    // Verify instrument exists
    const { data: instrument } = await supabase
      .from("instruments")
      .select("id")
      .eq("id", instrumentId)
      .single();

    if (!instrument) {
      return NextResponse.json(
        { error: "Instrument not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_events")
      .insert([
        {
          user_id: userData.user.id,
          instrument_id: instrumentId,
          name,
          impact,
          timestamp_utc,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating event:", error);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error in POST /api/terminal/events:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
