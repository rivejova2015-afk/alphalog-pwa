// src/app/api/tradermap/quarters/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/tradermap/quarters/[id]
 * Update quarter (dates, balances, or mark as completed)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Verify ownership
    const { data: quarter } = await supabase
      .from("tradermap_goal_quarters")
      .select("user_id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .single();

    if (!quarter) {
      return NextResponse.json(
        { error: "Quarter not found or unauthorized" },
        { status: 404 }
      );
    }

    const {
      start_balance,
      target_balance,
      current_balance,
    } = body as {
      start_balance?: number;
      target_balance?: number;
      current_balance?: number | null;
    };

    if (start_balance !== undefined) {
      if (typeof start_balance !== "number" || Number.isNaN(start_balance)) {
        return NextResponse.json(
          { error: "Invalid start_balance" },
          { status: 400 }
        );
      }
      if (start_balance < 0) {
        return NextResponse.json(
          { error: "start_balance must be >= 0" },
          { status: 400 }
        );
      }
    }

    if (target_balance !== undefined) {
      if (typeof target_balance !== "number" || Number.isNaN(target_balance)) {
        return NextResponse.json(
          { error: "Invalid target_balance" },
          { status: 400 }
        );
      }
      if (target_balance < 0) {
        return NextResponse.json(
          { error: "target_balance must be >= 0" },
          { status: 400 }
        );
      }
    }

    if (start_balance !== undefined && target_balance !== undefined) {
      if (target_balance <= start_balance) {
        return NextResponse.json(
          { error: "target_balance must be greater than start_balance" },
          { status: 400 }
        );
      }
    }

    if (current_balance !== undefined && current_balance !== null) {
      if (typeof current_balance !== "number" || Number.isNaN(current_balance)) {
        return NextResponse.json(
          { error: "Invalid current_balance" },
          { status: 400 }
        );
      }
      if (current_balance < 0) {
        return NextResponse.json(
          { error: "current_balance must be >= 0" },
          { status: 400 }
        );
      }
    }

    // Update quarter
    const { data, error } = await supabase
      .from("tradermap_goal_quarters")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating quarter:", error);
      return NextResponse.json(
        { error: "Failed to update quarter" },
        { status: 500 }
      );
    }

    // If quarter was just completed, create a progress event
    if (body.completed_at && !body.completed_at_was_null) {
      // Create progress event for quarter completion
      const { error: eventError } = await supabase
        .from("progress_events")
        .insert({
          user_id: userData.user.id,
          event_type: "goal_complete",
          ref_table: "tradermap_goal_quarters",
          ref_id: id,
          xp_delta: 500, // TODO: Define XP values in config
          occurred_at: new Date().toISOString(),
        });

      if (eventError) {
        console.warn("Error creating progress event:", eventError);
        // Continue anyway - event creation is non-blocking
      }

      // Send push notification for quarter completion
      const pushPayload = {
        userId: userData.user.id,
        title: '🎉 ¡Trimestre Completado!',
        body: `Has completado un trimestre exitosamente. ¡Excelente progreso!`,
        tag: 'alphalog-quarter-complete',
        data: {
          type: 'quarter_complete',
          quarter_id: id,
        },
      };

      fetch(`${request.headers.get('origin')}/api/push/notify-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.headers.get('authorization') || ''}`,
        },
        body: JSON.stringify(pushPayload),
      }).catch((error) => {
        console.warn('Failed to send quarter completion push:', error);
        // Don't fail the request if push fails
      });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error in PATCH /api/tradermap/quarters/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
