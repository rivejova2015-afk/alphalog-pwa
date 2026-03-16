// src/app/api/tradermap/level/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

/**
 * GET /api/tradermap/level
 * Get user's level state, create if doesn't exist
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_level_state")
      .select("*")
      .eq("user_id", userData.user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // Record doesn't exist - call helper function to create it
      const { data: created, error: createError } = await supabase.rpc(
        "upsert_user_level_state",
        { p_user_id: userData.user.id }
      );

      if (createError) {
        console.error("Error creating level state:", createError);
        return NextResponse.json(
          { error: "Failed to initialize level" },
          { status: 500 }
        );
      }

      // Fetch again
      const { data: levelState, error: fetchError } = await supabase
        .from("user_level_state")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (fetchError) {
        console.error("Error fetching level state:", fetchError);
        return NextResponse.json(
          { error: "Failed to fetch level" },
          { status: 500 }
        );
      }

      return NextResponse.json(levelState, {
        headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
      });
    }

    if (error) {
      console.error("Error fetching level state:", error);
      return NextResponse.json(
        { error: "Failed to fetch level" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/tradermap/level:", err);
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
