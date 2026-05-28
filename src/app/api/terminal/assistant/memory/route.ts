import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/log";

/**
 * GET /api/terminal/assistant/memory
 * Returns trader memory items ordered by importance.
 * Query params: asset (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const asset = request.nextUrl.searchParams.get("asset");

    let query = supabase
      .from("terminal_assistant_memory")
      .select("id, memory_type, content, importance_score, asset, source_session_id, created_at, updated_at")
      .eq("user_id", userId)
      .order("importance_score", { ascending: false })
      .order("last_accessed_at", { ascending: false });

    if (asset) {
      query = query.or(`asset.eq.${asset},asset.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Failed to fetch memory" }, { status: 500 });
    }

    return NextResponse.json({ memory: data ?? [] });
  } catch (err) {
    logError("Assistant Memory", { component: "terminal.assistant.memory", message: "GET error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/terminal/assistant/memory?id=uuid
 * Deletes a single memory item.
 * DELETE /api/terminal/assistant/memory?all=true
 * Deletes ALL memory items for the user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const id = request.nextUrl.searchParams.get("id");
    const all = request.nextUrl.searchParams.get("all") === "true";

    if (all) {
      const { error } = await supabase
        .from("terminal_assistant_memory")
        .delete()
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, deleted: "all" });
    }

    if (!id) {
      return NextResponse.json({ error: "id or all=true required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("terminal_assistant_memory")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: "Failed to delete memory item" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Assistant Memory", { component: "terminal.assistant.memory", message: "DELETE error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
