import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { runReportPipeline } from "@/lib/reports/runReport";
import type { Asset } from "@/lib/news/sources";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/terminal/chat/sessions/[id]/generate-report
 * Triggers the report pipeline for the session's asset.
 * The client displays the result as a system message in the chat.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Verify session ownership + get asset
    const { data: session, error: sessionError } = await supabase
      .from("terminal_chat_sessions")
      .select("asset")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const asset = session.asset as Asset;

    const result = await runReportPipeline({
      supabase,
      userId,
      asset,
      lookbackDays: 7,
    });

    return NextResponse.json({
      ok: result.outcome !== "failed",
      asset,
      outcome: result.outcome,
      reportId: result.reportId ?? null,
      relevantCount: result.relevantCount,
    });
  } catch (err) {
    console.error("[Chat Generate Report] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
