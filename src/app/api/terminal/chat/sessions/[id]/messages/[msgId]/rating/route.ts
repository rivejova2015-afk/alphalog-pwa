import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; msgId: string }> };

/**
 * POST /api/terminal/chat/sessions/[id]/messages/[msgId]/rating
 * Rates an assistant message and adjusts memory importance accordingly.
 * Body: { rating: 1 | -1 }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: sessionId, msgId } = await params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await request.json().catch(() => ({}));
    const rating = body.rating;
    if (rating !== 1 && rating !== -1) {
      return NextResponse.json({ error: "rating must be 1 or -1" }, { status: 400 });
    }

    // Verify message ownership
    const { data: msg, error: msgError } = await supabase
      .from("terminal_chat_messages")
      .select("id, role")
      .eq("id", msgId)
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .single();

    if (msgError || !msg || msg.role !== "assistant") {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Save rating on message
    await supabase
      .from("terminal_chat_messages")
      .update({ rating })
      .eq("id", msgId)
      .eq("user_id", userId);

    // Adjust importance_score on memory items from this session
    // Using raw SQL via rpc is not available — fetch and update individually
    const { data: memItems } = await supabase
      .from("terminal_assistant_memory")
      .select("id, importance_score")
      .eq("source_session_id", sessionId)
      .eq("user_id", userId);

    if (memItems && memItems.length > 0) {
      const delta = rating === 1 ? 5 : -10;
      for (const item of memItems) {
        const newScore = Math.min(100, Math.max(1, (item.importance_score as number) + delta));
        await supabase
          .from("terminal_assistant_memory")
          .update({ importance_score: newScore, updated_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("user_id", userId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Chat Rating] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
