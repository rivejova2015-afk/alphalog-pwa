// src/app/api/tradehub/reports/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRouteId } from "@/lib/api/routeParams";

/**
 * DELETE /api/tradehub/reports/{id}
 * Hard-delete report
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

    // Verify ownership
    const { data: existingReport } = await supabase
      .from("weekly_reports")
      .select("user_id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .single();

    if (!existingReport) {
      return NextResponse.json(
        { error: "Report not found or unauthorized" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("weekly_reports")
      .delete()
      .eq("id", id)
      .eq("user_id", userData.user.id);

    if (error) {
      console.error("Error deleting report:", error);
      return NextResponse.json(
        { error: "Failed to delete report" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in DELETE /api/tradehub/reports/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
