// src/app/api/accounts/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRouteId } from "@/lib/api/routeParams";
import { logAuditFromRequest } from "@/lib/security/auditLog";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * PATCH /api/accounts/[id]
 * Update or restore account
 * Body: {restore: true, ...other fields}
 * If restore: true, sets deleted_at = null
 * Otherwise: updates fields
 */
export async function PATCH(
  request: NextRequest,
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
      return NextResponse.json(
        { error: "Invalid resource id" },
        { status: 400 }
      );
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
      currency?: string;
      status?: string;
    };
    const body = (await request.json()) as unknown as PatchBody;
    const { restore, ...updateData } = body;

    // Verify account exists and belongs to user
    const { data: account, error: getError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", id)
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
        .eq("id", id);

      if (updateError) {
        console.error("Error restoring account:", updateError);
        return NextResponse.json(
          { error: "Failed to restore account" },
          { status: 500 }
        );
      }
    } else {
      const preparedUpdate: Record<string, unknown> = {};

      if (updateData.name && updateData.name.trim()) {
        preparedUpdate.name = updateData.name.trim();
      }

      if (updateData.category_id) {
        const { data: category, error: catError } = await supabase
          .from("account_categories")
          .select("id")
          .eq("id", updateData.category_id)
          .eq("user_id", userData.user.id)
          .is("deleted_at", null)
          .single();

        if (catError || !category) {
          return NextResponse.json(
            { error: "Category not found" },
            { status: 404 }
          );
        }

        preparedUpdate.category_id = category.id;
      }

      if (updateData.account_size !== undefined) {
        preparedUpdate.account_size =
          typeof updateData.account_size === "number"
            ? updateData.account_size
            : updateData.account_size
            ? parseFloat(updateData.account_size as string)
            : null;
      }

      if (updateData.current_balance !== undefined) {
        preparedUpdate.current_balance =
          typeof updateData.current_balance === "number"
            ? updateData.current_balance
            : updateData.current_balance
            ? parseFloat(updateData.current_balance as string)
            : null;
      }

      if (updateData.operation_state !== undefined) {
        preparedUpdate.operation_state = updateData.operation_state || null;
      }

      if (updateData.phase_status !== undefined) {
        preparedUpdate.phase_status = updateData.phase_status || null;
      }

      if (updateData.role !== undefined) {
        preparedUpdate.role = updateData.role || null;
      }

      if (updateData.withdrawals_enabled !== undefined) {
        preparedUpdate.withdrawals_enabled = !!updateData.withdrawals_enabled;
      }

      if (updateData.currency !== undefined) {
        preparedUpdate.currency = updateData.currency?.trim?.() || "USD";
      }

      if (updateData.status !== undefined) {
        preparedUpdate.status = updateData.status?.trim?.() || "active";
      }

      const { error: updateError } = await supabase
        .from("accounts")
        .update(preparedUpdate)
        .eq("id", id);

      if (updateError) {
        console.error("Error updating account:", updateError);
        return NextResponse.json(
          { error: "Failed to update account" },
          { status: 500 }
        );
      }
    }

    await logAuditFromRequest(
      { userId: userData.user.id, action: "update", resourceType: "account", resourceId: id, status: "success" },
      request
    );

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
 * Hard-delete account (cascade trades + evidence)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return unauthorized();
    }

    const userId = userData.user.id;
    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid resource id" },
        { status: 400 }
      );
    }

    // Verify account exists and belongs to user
    const { data: account, error: getError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (getError || !account) {
      return NextResponse.json(
        { error: "Account not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select("id, screenshot_path")
      .eq("account_id", id)
      .eq("user_id", userId);

    if (tradesError) {
      console.error("Error fetching trades for account delete:", tradesError);
      return NextResponse.json(
        { error: "Failed to delete account trades" },
        { status: 500 }
      );
    }

    const tradeIds = (trades || []).map((trade) => trade.id);
    const screenshotPaths = (trades || [])
      .map((trade) => trade.screenshot_path)
      .filter(Boolean) as string[];

    let evidenceQuery = supabase
      .from("tv_analysis_evidence")
      .select("id, image_path")
      .eq("user_id", userId);

    if (tradeIds.length > 0) {
      evidenceQuery = evidenceQuery.or(
        `account_id.eq.${id},trade_id.in.(${tradeIds.join(",")})`
      );
    } else {
      evidenceQuery = evidenceQuery.eq("account_id", id);
    }

    const { data: evidenceRows, error: evidenceError } = await evidenceQuery;

    const isMissingTable = (error: any) =>
      error?.code === "42P01" ||
      (typeof error?.message === "string" && error.message.toLowerCase().includes("does not exist"));

    if (evidenceError && !isMissingTable(evidenceError)) {
      console.error("Error fetching evidence for account delete:", evidenceError);
      return NextResponse.json(
        { error: "Failed to delete account evidence" },
        { status: 500 }
      );
    }

    const evidencePaths = (evidenceRows || [])
      .map((row: { image_path?: string | null }) => row.image_path)
      .filter(Boolean) as string[];

    if (evidencePaths.length > 0) {
      try {
        await supabase.storage.from("log_attachments").remove(evidencePaths);
      } catch (storageErr) {
        console.warn("Warning: Failed to delete evidence files:", storageErr);
      }
    }

    if (evidenceRows && evidenceRows.length > 0) {
      const evidenceIds = evidenceRows.map((row: { id: string }) => row.id);
      await supabase
        .from("tv_analysis_evidence")
        .delete()
        .in("id", evidenceIds)
        .eq("user_id", userId);
    }

    let tradeEvidenceQuery = supabase
      .from("trade_evidence")
      .select("id, file_path")
      .eq("user_id", userId);

    if (tradeIds.length > 0) {
      tradeEvidenceQuery = tradeEvidenceQuery.or(
        `account_id.eq.${id},trade_id.in.(${tradeIds.join(",")})`
      );
    } else {
      tradeEvidenceQuery = tradeEvidenceQuery.eq("account_id", id);
    }

    const { data: tradeEvidenceRows, error: tradeEvidenceError } = await tradeEvidenceQuery;

    if (tradeEvidenceError && !isMissingTable(tradeEvidenceError)) {
      console.error("Error fetching trade_evidence for account delete:", tradeEvidenceError);
      return NextResponse.json(
        { error: "Failed to delete account evidence" },
        { status: 500 }
      );
    }

    const tradeEvidencePaths = (tradeEvidenceRows || [])
      .map((row: { file_path?: string | null }) => row.file_path)
      .filter(Boolean) as string[];

    if (tradeEvidencePaths.length > 0) {
      try {
        await supabase.storage.from("log_attachments").remove(tradeEvidencePaths);
      } catch (storageErr) {
        console.warn("Warning: Failed to delete trade_evidence files:", storageErr);
      }
    }

    if (tradeEvidenceRows && tradeEvidenceRows.length > 0) {
      const tradeEvidenceIds = tradeEvidenceRows.map((row: { id: string }) => row.id);
      await supabase
        .from("trade_evidence")
        .delete()
        .in("id", tradeEvidenceIds)
        .eq("user_id", userId);
    }

    if (screenshotPaths.length > 0) {
      try {
        await supabase.storage.from("log_attachments").remove(screenshotPaths);
      } catch (storageErr) {
        console.warn("Warning: Failed to delete trade screenshots:", storageErr);
      }
    }

    if (tradeIds.length > 0) {
      await supabase
        .from("trades")
        .delete()
        .in("id", tradeIds)
        .eq("user_id", userId);
    }

    const { error: deleteError } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting account:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    await logAuditFromRequest(
      { userId, action: "delete", resourceType: "account", resourceId: id, status: "success" },
      request
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error in DELETE /api/accounts/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
