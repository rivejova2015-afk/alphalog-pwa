// src/app/api/tradehub/evidence/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/tradehub/evidence/{id}
 * Update evidence validation status
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
    const { validation_status } = body;

    if (!validation_status || !["needs_review", "valid", "invalid"].includes(validation_status)) {
      return NextResponse.json(
        { error: "Invalid validation_status" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingEvidence } = await supabase
      .from("tv_analysis_evidence")
      .select("user_id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
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
 * Soft-delete evidence
 */
export async function DELETE(
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

    // Verify ownership
    const { data: existingEvidence } = await supabase
      .from("tv_analysis_evidence")
      .select("user_id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .single();

    if (!existingEvidence) {
      return NextResponse.json(
        { error: "Evidence not found or unauthorized" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("tv_analysis_evidence")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

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
