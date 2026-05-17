// src/app/api/terminal/events/route.ts
import { createClient } from "@/lib/supabase/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { eventItemResponseSchema } from "@/lib/validation/schemas";
import { logError } from "@/lib/log";

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
      logError("TerminalEvents", { component: "GET", message: "Fetch error", error: error.message });
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const decrypted = (data || []).map((item) => ({
      ...item,
      name: decryptText(item.name),
    }));

    const contractResult = enforceResponseContract(eventItemResponseSchema.array(), decrypted);
    if (!contractResult.ok) {
      console.warn("[ContractGuard] GET /api/terminal/events contract violation:", contractResult.errors);
    }

    return NextResponse.json(decrypted, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    logError("TerminalEvents", { component: "GET", message: "Unexpected error", error: String(err) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
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
          name: encryptText(name),
          impact,
          timestamp_utc,
        },
      ])
      .select()
      .single();

    if (error) {
      logError("TerminalEvents", { component: "POST", message: "Create error", error: error.message });
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    const responsePayload = {
      ...data,
      name: decryptText(data.name),
    };

    const contractResult = enforceResponseContract(eventItemResponseSchema, responsePayload);
    if (!contractResult.ok) {
      console.warn("[ContractGuard] POST /api/terminal/events contract violation:", contractResult.errors);
    }

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    logError("TerminalEvents", { component: "POST", message: "Unexpected error", error: String(err) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
