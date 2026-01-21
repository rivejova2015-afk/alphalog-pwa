// src/app/api/accounts/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/accounts/[id]
 * Update or restore account
 * Body: {restore: true, ...other fields}
 * If restore: true, sets deleted_at = null
 * Otherwise: updates fields
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

    type PatchBody = {
      restore?: boolean;
      name?: string;
      category_id?: string;
      account_size?: number | string | null;
      current_balance?: number | string | null;
      operation_state?: string | null;
      phase_status?: string | null;
      role?: string | null;
      withdrawals_enabled?: boolean | null;
    };
    const body = (await request.json()) as unknown as PatchBody;
    const { restore, ...updateData } = body;

    // Verify account exists and belongs to user
    const { data: account, error: getError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", userData.user.id)
      .single();

    if (getError || !account) {
      return NextResponse.json(
        { error: "Account not found or unauthorized" },
        { status: 404 }
      );
    }

    // If restore, set deleted_at to null
    if (restore) {
      const { error: updateError } = await supabase
        .from("accounts")
        .update({ deleted_at: null })
        .eq("id", params.id);

      if (updateError) {
        console.error("Error restoring account:", updateError);
        return NextResponse.json(
          { error: "Failed to restore account" },
          { status: 500 }
        );
      }
    } else {
      // Update fields
      const { error: updateError } = await supabase
        .from("accounts")
        .update(updateData)
        .eq("id", params.id);

      if (updateError) {
        console.error("Error updating account:", updateError);
        return NextResponse.json(
          { error: "Failed to update account" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error in PATCH /api/accounts/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/accounts/[id]
 * Soft-delete account (sets deleted_at = now())
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

    // Verify account exists and belongs to user
    const { data: account, error: getError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", userData.user.id)
      .single();

    if (getError || !account) {
      return NextResponse.json(
        { error: "Account not found or unauthorized" },
        { status: 404 }
      );
    }

    // Soft-delete: set deleted_at = now()
    const { error: deleteError } = await supabase
      .from("accounts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error soft-deleting account:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error in DELETE /api/accounts/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
