import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRouteId } from "@/lib/api/routeParams";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return unauthorized();
    }

    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
    }

    const { data: existingTarget, error: existingError } = await supabase
      .from("intelligence_capital_targets")
      .select("id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .single();

    if (existingError || !existingTarget) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("intelligence_capital_targets")
      .update({
        manual_monthly_pct: null,
        manual_quarterly_pct: null,
        manual_semiannual_pct: null,
        manual_annual_pct: null,
        manual_updated_at: null,
      })
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .select(
        [
          "id",
          "account_type",
          "target_name",
          "target_capital",
          "capital_account_id",
          "manual_monthly_pct",
          "manual_quarterly_pct",
          "manual_semiannual_pct",
          "manual_annual_pct",
          "manual_updated_at",
          "custom_current_capital",
          "custom_current_updated_at",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .single();

    if (error) {
      console.error("Error deleting manual simulation:", error);
      return NextResponse.json(
        { error: "Failed to clear manual simulation" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in DELETE /api/intelligence/capital-targets/[id]/manual-simulation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
