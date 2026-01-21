// src/app/api/terminal/evidence/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/terminal/evidence/{id}
 * Update evidence report
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
    const { title, content, instrument_id } = body;

    // Verify ownership
    const { data: existingReport } = await supabase
      .from("terminal_evidence_reports")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existingReport || existingReport.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Report not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_evidence_reports")
      .update({
        title,
        content,
        instrument_id,
      })
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
    console.error("Error in PATCH /api/terminal/evidence/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/terminal/evidence/{id}
 * Soft-delete evidence report (cascades to attachments)
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
    const { data: existingReport } = await supabase
      .from("terminal_evidence_reports")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existingReport || existingReport.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Report not found or unauthorized" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("terminal_evidence_reports")
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
    console.error("Error in DELETE /api/terminal/evidence/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
