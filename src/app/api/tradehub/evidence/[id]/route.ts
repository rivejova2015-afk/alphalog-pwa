// src/app/api/tradehub/evidence/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRouteId } from "@/lib/api/routeParams";

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
      console.error("Error fetching trade_evidence:", tradeError);
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
        console.error("Error updating trade_evidence:", error);
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
      console.error("Error updating evidence:", error);
      return NextResponse.json(
        { error: "Failed to update evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error in PATCH /api/tradehub/evidence/[id]:", err);
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
      console.error("Error fetching trade_evidence:", tradeError);
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
          console.warn("Warning: Failed to delete evidence file:", storageErr);
        }
      }

      const { error } = await supabase
        .from("trade_evidence")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        console.error("Error deleting trade_evidence:", error);
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
        console.warn("Warning: Failed to delete evidence file:", storageErr);
      }
    }

    const { error } = await supabase
      .from("tv_analysis_evidence")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting evidence:", error);
      return NextResponse.json(
        { error: "Failed to delete evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in DELETE /api/tradehub/evidence/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
