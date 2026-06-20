// src/app/api/tradehub/evidence/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRouteId } from "@/lib/api/routeParams";
import { logError, logWarn } from "@/lib/log";

const isMissingTable = (error: any) =>
  error?.code === "42P01" ||
  (typeof error?.message === "string" &&
    error.message.toLowerCase().includes("does not exist"));

/**
 * PATCH /api/tradehub/evidence/{id}
 * Update evidence validation status
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid resource id" },
        { status: 400 }
      );
    }
    const body = await request.json();
    const { validation_status } = body;

    if (!validation_status || !["needs_review", "valid", "invalid"].includes(validation_status)) {
      return NextResponse.json(
        { error: "Invalid validation_status" },
        { status: 400 }
      );
    }

    const userId = userData.user.id;

    const { data: tradeEvidence, error: tradeError } = await supabase
      .from("trade_evidence")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (tradeError && !isMissingTable(tradeError)) {
      logError("TradehubEvidence", { component: "tradehub.evidence.[id]", message: "Error fetching trade_evidence:", error: tradeError instanceof Error ? tradeError.message : String(tradeError) });
      return NextResponse.json(
        { error: "Failed to update evidence" },
        { status: 500 }
      );
    }

    if (tradeEvidence) {
      const { data, error } = await supabase
        .from("trade_evidence")
        .update({ validation_status })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        logError("TradehubEvidence", { component: "tradehub.evidence.[id]", message: "Error updating trade_evidence:", error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
          { error: "Failed to update evidence" },
          { status: 500 }
        );
      }

      return NextResponse.json(data);
    }

    // Fallback legacy evidence
    const { data: existingEvidence } = await supabase
      .from("tv_analysis_evidence")
      .select("user_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!existingEvidence) {
      return NextResponse.json(
        { error: "Evidence not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("tv_analysis_evidence")
      .update({ validation_status })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logError("TradehubEvidence", { component: "tradehub.evidence.[id]", message: "Error updating evidence:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to update evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    logError("TradehubEvidence", { component: "tradehub.evidence.[id]", message: "Error in PATCH /api/tradehub/evidence/[id]:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tradehub/evidence/{id}
 * Hard-delete evidence (remove storage + row)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid resource id" },
        { status: 400 }
      );
    }
    const userId = userData.user.id;

    const { data: tradeEvidence, error: tradeError } = await supabase
      .from("trade_evidence")
      .select("id, file_path")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (tradeError && !isMissingTable(tradeError)) {
      logError("TradehubEvidence", { component: "tradehub.evidence.[id]", message: "Error fetching trade_evidence:", error: tradeError instanceof Error ? tradeError.message : String(tradeError) });
      return NextResponse.json(
        { error: "Failed to delete evidence" },
        { status: 500 }
      );
    }

    if (tradeEvidence) {
      if (tradeEvidence.file_path) {
        try {
          await supabase.storage.from("log_attachments").remove([tradeEvidence.file_path]);
        } catch (storageErr) {
          logWarn("TradeHubEvidence", "Failed to delete evidence file", { component: "tradehub.evidence.[id].delete.storage", error: storageErr instanceof Error ? storageErr.message : String(storageErr) });
        }
      }

      const { error } = await supabase
        .from("trade_evidence")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        logError("TradehubEvidence", { component: "tradehub.evidence.[id]", message: "Error deleting trade_evidence:", error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
          { error: "Failed to delete evidence" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Legacy evidence fallback
    const { data: existingEvidence } = await supabase
      .from("tv_analysis_evidence")
      .select("user_id, image_path")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!existingEvidence) {
      return NextResponse.json(
        { error: "Evidence not found or unauthorized" },
        { status: 404 }
      );
    }

    if (existingEvidence?.image_path) {
      try {
        await supabase.storage.from("log_attachments").remove([existingEvidence.image_path]);
      } catch (storageErr) {
        logWarn("TradeHubEvidence", "Failed to delete evidence file", { component: "tradehub.evidence.[id].delete.storage.fallback", error: storageErr instanceof Error ? storageErr.message : String(storageErr) });
      }
    }

    const { error } = await supabase
      .from("tv_analysis_evidence")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      logError("TradehubEvidence", { component: "tradehub.evidence.[id]", message: "Error deleting evidence:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to delete evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logError("TradehubEvidence", { component: "tradehub.evidence.[id]", message: "Error in DELETE /api/tradehub/evidence/[id]:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
